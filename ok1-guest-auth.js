'use strict';

angular.module('tetherApp', [
    'ngMaterial',
    'ngAnimate',
    'ngCookies',
    'ngTouch',
    'ngSanitize',
    'ui.router',
    'ui.select',
    'ngStorage',
    'toaster',
    'ngPasswordStrength',
    'angular-cache',
    'ab-base64',
    'ngMessages',
    'angular-carousel',
    'infinite-scroll',
    'monospaced.qrcode',
    'vcRecaptcha'
  ])



  .config(["$httpProvider", "uiSelectConfig", "CacheFactoryProvider", "$mdThemingProvider", "$mdIconProvider", "$provide", function($httpProvider, uiSelectConfig, CacheFactoryProvider, $mdThemingProvider, $mdIconProvider, $provide) {
    /**
     * Fix for hotmail.com users (when /#!/ becomes /#%21/)
     */
    if (window.location.hash.substr(0, 4) === '#%21') {
      window.location.replace(window.location.href.split('#%21').join('#!'));
    }

    $httpProvider.defaults.headers.common['X-Requested-With'] = 'AngularXMLHttpRequest';
    $httpProvider.defaults.headers.post['X-Requested-With'] = 'AngularXMLHttpRequest';
    $httpProvider.defaults.headers.common['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.headers.patch['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.headers.put['Content-Type'] = 'application/x-www-form-urlencoded;charset=utf-8';
    $httpProvider.defaults.transformRequest = function( data ) {
      return angular.isObject( data ) && String( data ) !== '[object File]' ? $.param( data ) : data;
    };

    $httpProvider.defaults.withCredentials = true;

    /**
     * ui-select default config
     */
    uiSelectConfig.theme = 'selectize';

    // Use minus sign for negative currency instead of parenteses
    $provide.decorator('$locale', ["$delegate", function($delegate) {
      $delegate.NUMBER_FORMATS.PATTERNS[1].negPre = '-\u00A4';
      $delegate.NUMBER_FORMATS.PATTERNS[1].negSuf = '';

      return $delegate;
    }]);
    /**
     * Material Theme
     */
    // Extend the teal theme with brand color
    var tetherBrandMap = $mdThemingProvider.extendPalette('teal', {
      '50': 'E1F2ED',
      '100': 'B9E1D4',
      '200': '90CFBB',
      '300': '62BBA0',
      '400': '41AD8C',
      '500': '22A079',
      '600': '1E916E',
      '700': '1B8262',
      '800': '187156',
      '900': '11533F'
    });
    var tetherBrandAccentMap = $mdThemingProvider.extendPalette('amber', {
      '50': 'EFEBE4',
      '100': 'DAD1C1',
      '200': 'C4B59C',
      '300': 'AC9774',
      '400': '9A8157',
      '500': '8A6D3B',
      '600': '7D6335',
      '700': '70582F',
      '800': '624D29',
      '900': '48391E'
    });
    // Register the new color palette map with the name <code>tetherBrand</code>
    $mdThemingProvider.definePalette('tetherBrand', tetherBrandMap);
    $mdThemingProvider.definePalette('tetherBrandAccent', tetherBrandAccentMap);
    // Use that theme for the primary intentions
    $mdThemingProvider.theme('default')
      .primaryPalette('tetherBrand')
      .accentPalette('tetherBrandAccent');
    // Define icon flags by currency iso
    $mdIconProvider
      .icon("flags:usdt", "assets/images/currency_logos/Flags_USD.svg", "21")
      .icon("flags:jpyt", "assets/images/currency_logos/Flags_JPY.svg", "21")
      .icon("flags:usd", "assets/images/currency_logos/Flags_USD.svg", "21")
      .icon("flags:eurt", "assets/images/currency_logos/Flags_Euro.svg", "21")
      .icon("flags:bitcoin", "assets/images/currency_logos/Flags_BTC.svg", "21")
      .icon("success", "assets/images/icons/success.svg")
      .icon("review", "assets/images/icons/review.svg")
      .icon("tx:receive", "assets/images/icons/add_funds.svg")
      .icon("tx:send", "assets/images/icons/send_funds.svg")
      .icon("tx:acquire", "assets/images/icons/add_funds.svg")
      .icon("tx:redeem", "assets/images/icons/send_funds.svg")
      .icon("tx:convert", "assets/images/icons/convert.svg")
      .icon("tx:unclaimed_return", "assets/images/icons/activity.svg")
      .icon("tx:claimed_own", "assets/images/icons/activity.svg")
      .icon("tx:adjustment_deposit", "assets/images/icons/add_funds.svg")
      .icon("tx:adjustment_withdraw", "assets/images/icons/send_funds.svg");

    /**
     * Cache defaults
     */
    angular.extend(CacheFactoryProvider.defaults, {
      maxAge: 60 * 60000,
      deleteOnExpire: 'aggressive',
      storageMode: 'sessionStorage',
      recycleFreq: 10000
    });

    // process flash messages
    $httpProvider.interceptors.push(["$rootScope", function($rootScope) {
      return {
        'response': function(response) {
          var flash = angular.fromJson(response.headers("X-Flash"));

          if (flash === null || Object.keys(flash).length === 0)
            return response;

          if(flash.success)
            $rootScope.Notifier.show('success', flash.success);

          if(flash.error)
            $rootScope.Notifier.show('error', flash.error);

          return response
        }
      };
    }]);
  }])



  .run(["$rootScope", "$sessionStorage", "$state", "User", "Wallet", "Notifier", "TetherApi", "AmbisafeModel", function($rootScope, $sessionStorage, $state, User, Wallet, Notifier, TetherApi, AmbisafeModel) {
    /**
     * Session Storage
     */
    var storageDefaults = {
      claimToken: null,
      selectedBalanceIso: '',
      deferredNotifications: []
    };

    $rootScope.$storage = $sessionStorage.$default(storageDefaults);

    // Wallet factory
    $rootScope.Wallet = Wallet;

    // User factory
    $rootScope.User = User;

    // AmbisafeModel factory
    $rootScope.AmbisafeModel = AmbisafeModel;

    // Notifier factory
    $rootScope.Notifier = Notifier;


    /**
     * Check access for requested pages
     */
    $rootScope.$on('$stateChangeStart', function(event, toState) {
      if (!toState.isPublic && User.isGuest()) {
        event.preventDefault();
        $state.go('layout_guest.login');
      }

      if (toState.guestOnly && User.isAuth()) {
        event.preventDefault();
        $state.go('layout_app.send_funds');
      }

      if (toState.controller == 'GeoCtrl') {
        TetherApi.clearCache('TetherApi.getGeoInfo');
        TetherApi.getGeoInfo()
          .success(function(resp){
            if (!resp.blocked) {
              $state.go('layout_guest.login')
            }
          });
      } else {
        User.redirectGeoBlocked();
      }
    });
  }]);

'use strict';

angular.module('tetherApp')
  .directive('twoFactorAuthLogin', function() {

    return {
      restrict: 'EA',
      require: 'ngModel',
      templateUrl: 'components/two_factor_auth_login/two_factor_auth.html',
      replace: true,
      scope: {
        ngModel: '=',
        wrongCode: '=',
        credentials: '=',
        token: '@',
        setCodeValid:'&'
      },

      controller: ["$rootScope", "$scope", "TetherApi", function($rootScope, $scope, TetherApi) {
        //TODO: Refactor, implement setCodeValidity where the directive is used and call $setValid on the input to set the wrongCode error.
        $scope.setCodeValidity = $scope.setCodeValidity || function(){};
        $scope.smsInProgress = false;
        $scope.smsSent = false;
        $scope.inProgress = false;
        $scope.sendSmsLogin = function(force) {
          $scope.force = force;
          if(!$scope.inProgress) {
            $scope.inProgress = true;
            $scope.smsInProgress = true;
            $scope.inProgress = true;
            TetherApi.sendSmsAsUnlogged($scope.credentials.login, $scope.credentials.password, $scope.force)
              .success(function() {
                $scope.smsInProgress = false;
                $scope.smsSent = true;
                setTimeout(function(){
                  $scope.$apply(function(){
                    $scope.smsSent = false;
                    $scope.inProgress = false;
                  })
                }, 30000)
              });
          }
        };

        $scope.sendSmsLogin(false);
        setTimeout(function(){
          angular.element('#auth_input_container').addClass('md-input-focused');
          angular.element('#auth_input_container input').focus();
        }, 100)
      }]
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('twoFactorAuth', function() {

    return {
      restrict: 'EA',
      require: 'ngModel',
      templateUrl: 'components/two_factor_auth/two_factor_auth.html',
      replace: true,
      scope: {
        ngModel: '=',
        wrongCode: '=',
        token: '@',
        setCodeValid:'&'
      },

      controller: ["$rootScope", "$scope", "TetherApi", function($rootScope, $scope, TetherApi) {
        //TODO: Refactor, implement setCodeValidity where the directive is used and call $setValid on the input to set the wrongCode error.
        $scope.setCodeValidity = $scope.setCodeValidity || function(){};
        $scope.smsInProgress = false;
        $scope.smsSent = false;
        $scope.inProgress = false;
        $scope.force = false;
        $scope.sendSms = function() {
          if(!$scope.inProgress) {
            $scope.inProgress = true;
            $scope.smsInProgress = true;
            $scope.inProgress = true;
            ($scope.token ? TetherApi.sendTokenSms($scope.token, $scope.force) : TetherApi.sendSms($scope.force))
              .success(function() {
                $scope.smsInProgress = false;
                $scope.smsSent = true;
                setTimeout(function(){
                  $scope.$apply(function(){
                    $scope.smsSent = false;
                    $scope.force = true;
                    $scope.inProgress = false;
                  })
                }, 30000)
              });
          }
        };

        $scope.sendSms();
      }]
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('passwordStrength', function() {
    return {
      restrict: 'E',
      templateUrl: 'components/password_strength/password_strength.html',
      scope: {
        model: '='
      }
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('checkNotices', ["$compile", "$http", "$templateCache", "$rootScope", "WITHDRAW_SETTINGS", "CONVERT_SUPPORTED_CURRENCIES", "Wallet", "TetherApi", function($compile, $http, $templateCache, $rootScope, WITHDRAW_SETTINGS, CONVERT_SUPPORTED_CURRENCIES, Wallet, TetherApi) {

    var templatesPath = 'components/notices/';
    var minimalWithdrawAmount = WITHDRAW_SETTINGS.minimal_amount + WITHDRAW_SETTINGS.wire_price;

    var noticeVariants = {
      email_verified: function() {
        return !$rootScope.User.account.email_verified;
      },

      two_factor_auth: function() {
        return !$rootScope.User.account.two_factor_auth_enabled;
      },

      geo_block: function() {
        return $rootScope.User.account.geo_blocked;
      },

      kyc_pending: function() {
        return $rootScope.User.account.kyc_pending;
      },

      kyc_verified: function() {
        return !$rootScope.User.account.kyc_verified;
      },

      has_balance: function() {
        var show = true;
        Wallet.balances.some(function(balance) {
          if (balance.iso != Wallet.selectedBalance.iso || balance.balance == 0)
            return false;

          show = false;
          return true;
        });

        return show;
      },

      has_balance_convert: function() {
        return noticeVariants.has_balance();
      },

      convert_available: function () {
        var show = true;
        var supportCurrencies = CONVERT_SUPPORTED_CURRENCIES;
        var isSupportedCurrency = supportCurrencies.some(function(elem){
          return Wallet.selectedBalance.iso === elem;
        });

        show = !isSupportedCurrency;

        return show;
      },

      convert_disabled: function () {
        return $rootScope.conv_disabled;
      },

      acquires_disabled: function () {
        return $rootScope.acquires_disabled;
      },

      redeems_disabled: function () {
        return $rootScope.redeems_disabled;
      },

      min_balance: function() {
        var show = true;
        angular.forEach(Wallet.balances, function(balance) {
          if (balance.iso == Wallet.selectedBalance.iso)
            show = balance.balance < minimalWithdrawAmount;
        });
        return show;
      },

      bitcoin_withdraw: function() {
        return (Wallet.selectedBalance.iso == 'bitcoin');
      },

      no_activity: function() {
        return typeof $rootScope.$storage.ledger !== 'undefined' && $rootScope.$storage.ledger.length == 0;
      },

      btc_currency: function () {
        return Wallet.selectedBalance.iso === 'bitcoin';
      },

      tx_frozen: function () {
        if ($rootScope.User.account.tx_frozen_type == 1) {
          return true
        } else {
          return false
        } 
      },

      conv_frozen: function () {
        return $rootScope.User.account.tx_frozen;
      }
    };

    var loadTemplate = function(templateUrl) {
      return $http.get(templateUrl, {cache: $templateCache});
    };

    var checkNoticesProcess = function(scope, element, attrs, ctrl, transclude) {
      var noticeTriggered = false;

      angular.forEach(scope.checkNotices, function(item) {
        if (!noticeTriggered && angular.isDefined(noticeVariants[item]) && noticeVariants[item](scope.$parent)) {

          noticeTriggered = true;

          loadTemplate(templatesPath + '_' + item + '.html')
            .success(function(html) {
              element.html($compile(html)(scope));
            });
        }
      });

      scope.$emit('checkNotices', noticeTriggered);

      if (!noticeTriggered) {
        transclude(scope.$parent, function(clone){
          element.html(clone);
        });
      }
    };

    return {
      restrict: 'EA',
      transclude: true,
      scope: {
        checkNotices: '='
      },

      link: function($scope, $element, $attributes, controller, $transclude) {
        /**
         * Watch balances
         */
        $rootScope.$watch('Wallet.balances',
          function(newVal) {
            if (newVal.length) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

        $rootScope.$watch('Wallet.selectedBalance',
          function(newVal) {
            if (false == angular.equals(newVal, {})) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);


        /**
         * Watch User Account
         */
        $rootScope.$watch('User.account',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

        $rootScope.$watch('$storage.ledger',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

         /**
         * Watch Conversions status
         */
        $rootScope.$watch('conv_disabled',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

        /**
         * Watch Acquires status
         */
        $rootScope.$watch('acquires_disabled',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

        /**
         * Watch Redeems status
         */
        $rootScope.$watch('redeems_disabled',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);

        // Watch tx status
        $rootScope.$watch('User.account.tx_frozen',
          function(newValue) {
            if (!angular.equals(newValue, undefined)) {
              checkNoticesProcess($scope, $element, $attributes, controller, $transclude);
            }
          }, true);
      },

      controller: ["$rootScope", "$scope", "TetherApi", "APP_URL", function($rootScope, $scope, TetherApi, APP_URL) {
        $scope.APP_URL = APP_URL;
        $scope.sendEmailVerificationInProgress = false;

        $scope.sendEmailVerification = function() {
          $scope.sendEmailVerificationInProgress = true;

          TetherApi.sendEmailVerification()
            .error(function() {
              $scope.sendEmailVerificationInProgress = false;
            });
        };

        $scope.minimalWithdrawBalance = minimalWithdrawAmount;
      }]
    };
  }]);


'use strict';

angular.module('tetherApp')
  .directive('googleTwoFactorAuth', function() {

    return {
      restrict: 'EA',
      require: 'ngModel',
      templateUrl: 'components/google_two_factor_auth/google_two_factor_auth.html',
      replace: true,
      scope: {
        ngModel: '=',
        wrongCode: '=',
        token: '@',
        setCodeValid:'&'
      },

      controller: ["$rootScope", "$scope", "TetherApi", function($rootScope, $scope, TetherApi) {
        $scope.setCodeValidity = $scope.setCodeValidity || function(){};
      }]
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('currencyDropdown', function() {
    return {
      restrict: 'E',
      require: 'ngModel',
      templateUrl: 'components/currency_dropdown/currency_dropdown.html',
      replace: true,
      scope: {
        ngModel: '=',
        getFilter: '&'
      },
      controller: ["$scope", "$rootScope", "Wallet", function($scope, $rootScope, Wallet){
        $scope.balancesFilter = $scope.getFilter();

        $scope.updateCode = function(){
          Wallet.balances.some(function(balance) {
            if (balance.iso == $scope.ngModel) {
              $scope.currencyCode = balance.code;
              return true;
            }
          });
        };

        $scope.$watch("ngModel", function(){
          $scope.updateCode();
        });

        $rootScope.$watch('Wallet.balances',
          function(newValue) {
            if (newValue.length > 0) {
              $scope.updateCode();
            }
          }, true);

        $scope.updateCode();
      }]
    };
  });

'use strict';

angular.module('tetherApp')
  .controller('WithdrawCtrl', ["$rootScope", "$scope", "$state", "TetherApi", "Wallet", "WITHDRAW_SETTINGS", "AmbisafeModel", function ($rootScope, $scope, $state, TetherApi, Wallet, WITHDRAW_SETTINGS, AmbisafeModel) {
    $scope.redeemNotices = ['two_factor_auth', 'geo_block', 'email_verified', 'tx_frozen', 'kyc_pending', 'kyc_verified', 'bitcoin_withdraw', 'redeems_disabled', 'min_balance'];
    TetherApi.getAccount().then(function(data) {
      $scope.account_type = data.data.data.account_type
    })
    
    TetherApi.getCompliance().then(function(data) {
      $scope.user_bk_info = data.data.data
    })
    
    $scope.withdrawCurrencies = function(){
      return function(value, index){
        return value.tethered && value.balance > 0;
      }
    };

    $scope.minimalAmount = WITHDRAW_SETTINGS.minimal_amount;
    $scope.express_wire_price = WITHDRAW_SETTINGS.express_wire_price;
    $scope.express_wire_percent = WITHDRAW_SETTINGS.express_wire_percent;
    $scope.calculateFee = function(){
      var amount = $scope.model.amount || 0;
      var percent = $scope.model.isExpress ? WITHDRAW_SETTINGS.express_wire_percent : WITHDRAW_SETTINGS.wire_percent;
      var fee = amount * percent / 100;
      $scope.model.feePercent = percent;
      $scope.model.feeMin = $scope.model.isExpress ? WITHDRAW_SETTINGS.express_wire_price : WITHDRAW_SETTINGS.wire_price;
      $scope.model.fee = Math.max($scope.model.feeMin, fee);
      $scope.model.totalAmount = amount + $scope.model.fee;
    };

    $scope.confirm = function(){
      $scope.model.inProgress = true;
      //check if user has tx_frozen
      if ($rootScope.User.account.tx_frozen) {
        $rootScope.Notifier.show("error", "An Error occurred while processing your request. Please contact support@tether.to and include this error code: ERR-wd-hf45596")
        $scope.model.inProgress = false;
        return
      } 
      //validate user has fund
      angular.forEach(Wallet.balances, function(value) {
        if (value.iso == Wallet.selectedBalance.iso)
          if (value.balance >= $scope.model.totalAmount)
            $state.go("layout_app.withdraw.review");
          else
            $rootScope.Notifier.show("error", "You have insufficient funds")
      });
      $scope.model.inProgress = false;
    };

    $scope.goBack = function(){
      $state.go('layout_app.withdraw.currency', {currency: Wallet.selectedBalance.iso});
    };

    $scope.withdraw = function(){
      $scope.model.inProgress = true;
      TetherApi.redeem($scope.model.amount, Wallet.selectedBalance.code, $scope.model.isExpress, $scope.model.token, $scope.model.verification)
        .success(function (result) {
          if (result.status == "success") {

            var privateKey = AmbisafeModel.account.data.private_key;
            var transaction = Ambisafe.signTransaction(result.transaction, privateKey);
            TetherApi.finalizeRedeem(result.signedTransactionInfo, transaction)
              .success(function (response) {
                if (response.status == 'success') {
                  $scope.model.today = new Date();
                  $state.go("layout_app.withdraw.receipt");
                  $rootScope.Wallet.refreshBalances(true)
                }
              })
              .error(function (response) {
                $rootScope.Notifier.show('error', response.message);
              });
          }  else {
            // TODO: Refactor
            $scope.reviewWithdrawForm.twoFactorAuthForm.twoFactorAuthCode.$error["wrongCode"] = true;
          }
        }).then(function(result){
          $scope.model.inProgress = false;
        })
    };

    $scope.restartWithdraw = function(){
      $scope.model.amountWire = "";
      $scope.model.amount = "";
      $scope.model.verification = "";
      $scope.model.token = 0;
      TetherApi.getRedeemToken()
        .success(function(result){
          if(result.status == "success")
            $scope.model.token = result.data;
        });
      $state.go('layout_app.withdraw.currency', {currency: Wallet.selectedBalance.iso});
    };

    $scope.seeActivity = function(){
      $state.go('layout_app.activity')
    };

    $scope.send = function(){
      $state.go('layout_app.send_funds')
    };

    $scope.getFeeMessage = function() {
      var currency = Wallet.selectedBalance;

      return 'We redeem ' + currency.symbol
        + ' via international wire transfer. You will pay a fee of ' + $scope.model.feePercent + '% of the amount wired, with a minimum of '
        + currency.symbol + $scope.model.feeMin + ' ' + currency.code;
    };

    $rootScope.$watch('Wallet.selectedBalance',
      function() {
        $scope.currencyIso = Wallet.selectedBalance.iso;
      }, true);

    $scope.$watch('currencyIso',
      function(newVal) {
        if (newVal)
          Wallet.setSelectedBalance(newVal);
      });

  }]);


'use strict';

angular.module('tetherApp')
  .controller('SettingsCtrl', ["$scope", "$rootScope", "$window", "Modal", "TetherApi", "$state", "User", "base64", "TIMEZONES", "API_PERMISSIONS_LIST", "PASSWORD_REGEXP", "COUNTRIES", function ($scope, $rootScope, $window, Modal, TetherApi, $state, User, base64,
                                        TIMEZONES, API_PERMISSIONS_LIST, PASSWORD_REGEXP, COUNTRIES) {

    $scope.timezonesList = TIMEZONES;
    $scope.PASSWORD_REGEXP = PASSWORD_REGEXP;

    $scope.noticesForEmail = ['email_verified'];
    $scope.noticesForApi = ['two_factor_auth', 'geo_block', 'email_verified', 'kyc_pending', 'kyc_verified'];
    $scope.apiKeys = {};

    $scope.initAccount = function() {
      $scope.model.timezone = $rootScope.User.account.timezone;

      // Get country name
      if ($rootScope.User.account.country_of_residence) {
        COUNTRIES.some(function(country) {
          if (country.code == $rootScope.User.account.country_of_residence) {
            $rootScope.User.account.country_of_residence_name = country.name;
            return true;
          }
        });
      }

      $scope.displayPhoneNumber = '+' + $rootScope.User.account.phone_number;
    };

    $scope.initAccount();


    /**
     * Get API Keys
     */
    $scope.refreshApiKeys = function (code) {
      TetherApi.getApiKeys(code)
        .success(function (resp) {
          if (angular.isDefined(resp.error)) {
            $rootScope.Notifier.show('error', resp.error, 'Error');
            return;
          }

          $scope.apiKeys = resp;
          _.each($scope.apiKeys, function(api) {
            api.key_encoded = encodeURIComponent(api.key)
            if (api.secret) {
              api.secret_encoded = encodeURIComponent(api.secret)
            } else if (!api.secret && code) {
              $rootScope.Notifier.show('error', 'The 2fa code you entered is wrong');
            }
          })
        });
    };

    $scope.refreshApiKeys();

    /**
     * Update password
     */
    $scope.savePassword = function () {
      $scope.model.inProgress = true;

      $rootScope.$storage.rawPassword = $scope.model.password;
      $rootScope.AmbisafeModel.account.setNewPassword($scope.model.password);

      var
        passwordHash = $rootScope.AmbisafeModel.deriveKey($scope.model.password),
        walletContainer = $rootScope.AmbisafeModel.account.getStringContainer();

      TetherApi.updatePassword({password: passwordHash, password_confirmation: passwordHash, wallet_container: base64.encode(walletContainer)})
        .success(function (resp) {
          $scope.model.inProgress = false;

          if (resp.status == "success") {
            $scope.model.password = '';
            $scope.model.passwordConfirm = '';

            if ($scope.profileForm) {
              $scope.profileForm.$setPristine();
              $scope.profileForm.$setUntouched();
            }

            $rootScope.Notifier.show('success', 'Password successfully changed.');
          }
        })
        .error(function () {
          $scope.model.inProgress = false;
        });
    };

    /**
     * Update timezone
     */
    $scope.savePreferences = function () {
      TetherApi.updateAccount({timezone: $scope.model.timezone})
        .success(function (resp) {
          if (resp.status=="success") {
            $rootScope.Notifier.show('success', 'Settings successfully updated.');
            $rootScope.User.refreshAccount();
          }
        });
    };

    /**
     * Create/update new API key
     */
    $scope.saveApiKey = function (keyId, $event) {
      Modal.show({
        controller: 'ApiPermissionsModalCtrl',
        templateUrl: 'modules/settings/api_key_permissions.modal.html',
        close: function () {
          $scope.refreshApiKeys();
        },
        targetEvent: $event,
        resolve: {
          keyId: function () {
            return keyId;
          },
          keyCode: function () {
            var keyCode = '';

            keyId && angular.forEach($scope.apiKeys, function (key) {
              if (key.id == keyId)
                keyCode = key.key;
            });

            return keyCode;
          },
          keyPermissions: function () {
            var result = [];

            keyId && angular.forEach($scope.apiKeys, function (key) {
              if (key.id == keyId)
                result = key.permissions;
            });

            return result;
          }
        }
      });
    };

    $scope.isAllPermissionsSelected = function (permissions) {
      return API_PERMISSIONS_LIST.length == permissions.length;
    };


    /**
     * Activate API key
     * @param keyId
     */
    $scope.activateApiKey = function (keyId, $event) {
      Modal.show({
        controller: 'ApiKeyActivationModalCtrl',
        templateUrl: 'modules/settings/api_key_activation.modal.html',
        close: function () {
          $scope.refreshApiKeys();
        },
        targetEvent: $event,
        resolve: {
          keyId: function () {
            return keyId;
          },
          keyCode: function () {
            var keyCode = '';

            keyId && angular.forEach($scope.apiKeys, function (key) {
              if (key.id == keyId)
                keyCode = key.key;
            });

            return keyCode;
          }
        }
      });
    };


    /**
     * Delete API Key
     * @param keyId
     */
    $scope.deleteApiKey = function (keyId, $event) {
      return Modal.show({
        controller: 'ApiKeyDeletionModalCtrl',
        templateUrl: 'modules/settings/api_key_deletion.modal.html',
        targetEvent: $event,
        resolve: {
          keyId: function () {
            return keyId;
          },
          keyCode: function () {
            var keyCode = '';

            keyId && angular.forEach($scope.apiKeys, function (key) {
              if (key.id == keyId)
                keyCode = key.key;
            });

            return keyCode;
          }
        },
        close: function (resp) {
          $scope.refreshApiKeys();
        }
      });
    };

    /**
     * Show Secret Keys
     */
    $scope.showSecretKeys = function ($event) {
      Modal.show({
        controller: 'ApiKeySecretModalCtrl',
        templateUrl: 'modules/settings/api_key_secret.modal.html',
        targetEvent: $event,
        close: function (data) {
          $scope.refreshApiKeys(data.twoFactorAuthCode);
        }
      });
    };

    /**
     * Hide Secret Keys
     */
    $scope.hideSecretKeys = function () {
      $scope.refreshApiKeys();
    };

    /**
     * Is API Keys available
     * @returns {boolean|*}
     */
    $scope.isApiKeysAvailable = function () {
      return !$rootScope.User.account.geo_blocked && $rootScope.User.account.email_verified
        && $rootScope.User.account.two_factor_auth_enabled && $rootScope.User.account.kyc_verified;
    };

    $scope.disable2fa = function() {
      $state.go("layout_guest.2fa_disable");
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('ApiKeySecretModalCtrl', ["$rootScope", "$scope", "Modal", function ($rootScope, $scope, Modal) {
    $scope.$root = $rootScope
    $scope.twoFactorAuthCode = '';

    $scope.showSecrets = function() {
      Modal.close({
        twoFactorAuthCode: $scope.twoFactorAuthCode
      });
    };

    $scope.cancel = function() {
      Modal.dismiss('cancel');
    };

  }]);

'use strict';

angular.module('tetherApp')
    .controller('ApiPermissionsModalCtrl', ["$scope", "$rootScope", "Modal", "TetherApi", "API_PERMISSIONS_LIST", "keyId", "keyCode", "keyPermissions", function ($scope, $rootScope, Modal, TetherApi, API_PERMISSIONS_LIST, keyId, keyCode, keyPermissions) {

    $scope.permissionsList = API_PERMISSIONS_LIST;
    $scope.keyId = keyId;
    $scope.keyCode = keyCode;
    $scope.selectedPermissions = {};
    $scope.twoFactorAuthCode = '';
    $scope.errorMessage = '';
    $scope.inProgress = false;
    $scope.wrongOtp = false;

    if (keyId && keyPermissions.length > 0) {
      angular.forEach(keyPermissions, function(permissionsItem) {
        $scope.selectedPermissions[permissionsItem] = true;
      });
    }

    $scope.$watch('selectAll', function(newVal) {
      if (angular.isUndefined(newVal))
        return;

      angular.forEach($scope.permissionsList, function(permission) {
        $scope.selectedPermissions[permission] = newVal;
      });
    });

    $scope.save = function () {
      $scope.errorMessage = '';
      $scope.inProgress = true;
      $scope.wrongOtp = false;

      var permissions = [];

      angular.forEach($scope.selectedPermissions, function(val, key) {
        val && permissions.push(key);
      });

      if (!keyId) {
        // Create new key
        TetherApi.createApiKey(permissions)
          .success(function(resp) {
            if (resp.id) {
              Modal.close();
              $rootScope.Notifier.show('success', 'API key has been successfully created. You need to activate the new key.');
            }
            else if (resp.error) {
              $scope.errorMessage = resp.error;
              $scope.inProgress = false;
            }
            else {
              Modal.close();
              $rootScope.Notifier.show('error');
            }
          })
          .error(function() {
            Modal.close();
            $rootScope.Notifier.show('error');
          });
      }
      else {
        // Update key
        TetherApi.updateApiKey(keyId, permissions, $scope.ApiKeyPermissionsForm.twoFactorAuthForm.twoFactorAuthCode.$modelValue)
          .success(function(resp) {
            $scope.inProgress = false;

            if (resp.success) {
              Modal.close();
              $rootScope.Notifier.show('success', 'API key has been successfully updated.');
            }
            else if (resp.error) {
              // TODO refactor
              if (resp.error == "The 2FA code you entered is wrong") {
                $scope.ApiKeyPermissionsForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", false);
              }
              else {
                $scope.errorMessage = resp.error;
              }
            }
            else {
              Modal.close();
              $rootScope.Notifier.show('error');
            }
          })
          .error(function() {
            Modal.close();
            $rootScope.Notifier.show('error');
          });
      }
    };

    $scope.cancel = function () {
        Modal.close();
    };

    // reset wrong code validity on typing
    $scope.setTwoFactorAuthValid = function(){
      $scope.ApiKeyPermissionsForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", true);
    };

  }]);

'use strict';

angular.module('tetherApp')
    .controller('ApiKeyDeletionModalCtrl', ["$scope", "$rootScope", "TetherApi", "Modal", "keyId", "keyCode", function ($scope, $rootScope, TetherApi, Modal, keyId, keyCode) {

    $scope.twoFactorAuthCode = '';
    $scope.keyCode = keyCode;
    $scope.errorMessage = '';
    $scope.inProgress = false;
    $scope.wrongOtp = false;

    $scope.delete = function () {
      $scope.errorMessage = '';
      $scope.inProgress = true;
      $scope.wrongOtp = false;
      TetherApi.deleteApiKey(keyId, $scope.apiKeyDeletionForm.twoFactorAuthForm.twoFactorAuthCode.$modelValue)
        .success(function(resp) {
          $scope.inProgress = false;

          if (resp.status == 'success') {
            Modal.close();
            $rootScope.Notifier.show('success', 'API key has been successfully deleted.');
          }
          else if (resp.error) {
            // TODO refactor
            if (resp.error == "The 2FA code you entered is wrong") {
              $scope.apiKeyDeletionForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", false);
            }
            else {
              $scope.errorMessage = resp.error;
            }}
          else {
            Modal.dismiss('error');
            $rootScope.Notifier.show('error');
          }
        })
        .error(function() {
          Modal.dismiss('error');
          $rootScope.Notifier.show('error');
        });
    };

    $scope.cancel = function () {
      Modal.dismiss('cancel');
    };

    // reset wrong code validity on typing
    $scope.setTwoFactorAuthValid = function(){
        $scope.apiKeyDeletionForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", true);
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('ApiKeyActivationModalCtrl', ["$scope", "$rootScope", "Modal", "TetherApi", "keyCode", "keyId", function ($scope, $rootScope, Modal, TetherApi, keyCode, keyId) {

    $scope.keyCode = keyCode;
    $scope.keyId = keyId;
    $scope.keyCode_encoded = encodeURIComponent($scope.keyCode);
    $scope.keyId_encoded = encodeURIComponent($scope.keyId);
    $scope.activationCode = '';
    $scope.activationSendInProgress = false;
    $scope.activationSent = false;
    $scope.errorMessage = '';
    $scope.inProgress = false;

    $scope.resendCode = function () {
      $scope.activationSendInProgress = true;

      TetherApi.sendActivationCode(keyId)
        .success(function () {
          $scope.activationSendInProgress = false;
          $scope.activationSent = true;
        })
        .error(function () {
          $rootScope.Notifier.show('error');
        });
    };

    $scope.activate = function () {
      $scope.errorMessage = '';
      $scope.inProgress = true;

      TetherApi.activateApiKey(keyId, $scope.activationCode, $scope.twoFactorAuthCode)
        .success(function (resp) {
          $scope.inProgress = false;
          if (resp.status == "success") {
            Modal.close();
            $rootScope.Notifier.show('success', 'API key has been successfully activated.');
            Modal.show({
              controller: 'ApiKeyActivationModalCtrl',
              templateUrl: 'modules/settings/api_key_activated.modal.html',
              resolve: {
                keyId: function () {
                  return resp.key_id;
                },
                keyCode: function () {
                  return resp.key_code;
                }
              }
            });
          }
          else if (resp.status = "error") {
            $scope.activationForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", resp.errors.otp);
            $scope.activationForm.confirmationCode.$setValidity("wrongCode", resp.errors.confirmation)
          }
          else {
            Modal.dismiss('error');
            $rootScope.Notifier.show('error');
          }
        })
        .error(function () {
          Modal.dismiss('error');
          $rootScope.Notifier.show('error');
        });
    };

    $scope.cancel = function () {
      Modal.dismiss('cancel');
    };


    // reset wrong code validity on typing
    $scope.setTwoFactorAuthValid = function(){
      $scope.activationForm.twoFactorAuthForm.twoFactorAuthCode.$setValidity("wrongCode", true);
    };

    $scope.setConfirmationValid = function(){
        $scope.activationForm.confirmationCode.$setValidity("wrongCode", true)
    }

  }]);

'use strict';

angular.module('tetherApp')
  .controller('SendFundsExplanationModalCtrl', ["$scope", "Modal", function ($scope, Modal) {

    $scope.close = function () {
      Modal.close('close');
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('SendFundsCtrl', ["$scope", "$rootScope", "$state", "TetherApi", "Modal", "Wallet", "AmbisafeModel", function ($scope, $rootScope, $state, TetherApi, Modal, Wallet, AmbisafeModel) {

    $scope.model.inputPattern = new RegExp('^[0-9]+(\.[0-9]{1,' + Wallet.selectedBalance.precision + '})?$');

    $scope.sendNotices = ['two_factor_auth', 'email_verified', 'tx_frozen', 'has_balance'];

    $scope.showExplanations = function($event){
      Modal.show({
        controller: 'SendFundsExplanationModalCtrl',
        templateUrl: 'modules/send_funds/send_funds_explanation.modal.html',
        targetEvent: $event
      })
    };

    $scope.checkWarning = function () {
      if ($scope.sendForm.recipient.$valid)
        // Validate external address
        TetherApi.checkRecipient($scope.model.recipient, Wallet.selectedBalance.code)
          .success(function (confirmation) {
            if (confirmation.status == "success")
              $scope.model.showWarning = confirmation.show_warning;
          });
      else
        $scope.model.showWarning = false;
    };

    $scope.currenciesFilter = function(){
      return function(currency){
        return currency.balance > 0;
      }
    };

    $scope.$watch('currencyIso', function (ccy) {
      if (ccy == 'bitcoin') {
        $scope.minAmount = 0.001
      } else {
        $scope.minAmount = 5
      }
    })

    $scope.confirm = function () {
      if ($scope.sendForm.$valid) {
        $scope.model.inProgress = true;
        // Get account balances
        TetherApi.validateSend($scope.model.recipient, $scope.model.amount, Wallet.getBalanceByIso($scope.currencyIso).code, $scope.model.memo)
          .success(function (confirmation) {
            if (confirmation.status == "success") {
              $scope.model.recipient = confirmation.recipient;
              $scope.model.showWarning = confirmation.show_warning;
              $state.go("layout_app.send_funds.review");
              $scope.model.inProgress = false;
            } else {
              $rootScope.Notifier.show('error', 'Invalid Address, URL or Amount')
              $scope.model.inProgress = false;
            }
          });
      }
    };

    $scope.goBack = function () {
      $state.go('layout_app.send_funds.currency', {currency: Wallet.selectedBalance.iso});
    };

    $scope.sendFunds = function () {
      $scope.model.inProgress = true;
      TetherApi.initiateSend($scope.model.recipient, $scope.model.amount, Wallet.getBalanceByIso($scope.currencyIso).code, $scope.model.memo, $scope.model.verification)
        .success(function (response) {
          if (response.status == 'success') {
            var privateKey = AmbisafeModel.account.data.private_key;
            var transaction = Ambisafe.signTransaction(response.transaction, privateKey);
            TetherApi.finalizeSend(response.signedTransactionInfo, transaction)
              .success(function (response) {
                if (response.status == 'success') {
                  $scope.model.today = new Date();
                  $scope.sendNotices = [];
                  $state.go("layout_app.send_funds.receipt");
                  Wallet.refreshBalances(true);
                }
              })
              .error(function(){
                $scope.model.inProgress = false;
              });
          } else {
            // TODO: Refactor
            $scope.reviewSendForm.twoFactorAuthForm.twoFactorAuthCode.$error["wrongCode"] = true;
            $scope.model.inProgress = false;
          }
        })
        .error(function(){
          $scope.model.inProgress = false;
        });
    };

    $scope.restartSend = function () {
      $scope.model.recipient = "";
      $scope.model.amount = "";
      $scope.model.memo = "";
      $scope.model.verification = "";
      $state.go('layout_app.send_funds.currency', {currency: Wallet.selectedBalance.iso});
    };

    $scope.seeActivity = function () {
      $state.go('layout_app.activity')
    };

    $scope.withdraw = function () {
      $state.go('layout_app.withdraw')
    };

    $rootScope.$watch('Wallet.selectedBalance',
      function() {
        var currency = Wallet.selectedBalance;
        $scope.model.inputPattern = new RegExp('^[0-9]+(\.[0-9]{1,' + currency.precision + '})?$');
        $scope.currencyIso = currency.iso;
      }, true);

    $scope.$watch('currencyIso',
      function(newVal) {
        if (newVal)
          Wallet.setSelectedBalance(newVal);
      });

  }]);

'use strict';

angular.module('tetherApp')
  .controller('LayoutGuestCtrl', ["$scope", "$rootScope", "$state", "APP_URL", "CMS_URL", function ($scope, $rootScope, $state, APP_URL, CMS_URL) {
    $scope.$state = $state;

    $scope.layoutModel = {
      APP_URL: APP_URL,
      CMS_URL: CMS_URL,
      currentDate: new Date()
    };

  }]);


'use strict';

angular.module('tetherApp')
    .controller('LayoutAppCtrl', ["$scope", "$rootScope", "$state", "$sce", "$timeout", "$mdSidenav", "$mdUtil", "$window", "APP_URL", "CMS_URL", "TETHER_LINKS", "User", "TetherApi", "Notifier", "Modal", "Wallet", function ($scope, $rootScope, $state, $sce, $timeout, $mdSidenav, $mdUtil, $window,
                                           APP_URL, CMS_URL, TETHER_LINKS, User, TetherApi, Notifier, Modal, Wallet) {

    $scope.$state = $state;

    $scope.layoutModel = {
      APP_URL: APP_URL,
      CMS_URL: CMS_URL,
      TETHER_LINKS: TETHER_LINKS,
      currentDate: new Date(),
      isSidebarVisible: false
    };

    $scope.goUrl = function(url) {
      $window.location = url;
    };

    /**
     * Side Navigation
     */
    $scope.toggleSideNavRight = $mdUtil.debounce(function(){
      $mdSidenav('sidenav-right').toggle();
    }, 300);

    $scope.closeSideNavRight = function () {
      $mdSidenav('sidenav-right').close();
    };

    /**
     * Balances
     */
    $scope.switchSelectedBalance = function(currency, force) {
      if (force || Wallet.selectedBalance.iso != currency.iso) {
        Wallet.setSelectedBalance(currency.iso);

        var pagesWithCurrency = [
          'layout_app.send_funds',
          'layout_app.deposit',
          'layout_app.deposit_wire',
          'layout_app.withdraw'
        ];

        pagesWithCurrency.some(function(page) {
          if ($state.includes(page)) {
            $state.go('^.currency', {currency: currency.iso});
            return true;
          }
        });
      }
    };

    $rootScope.$watch('Wallet.balances', function (balances) {
      _.each(balances, function (bal) {
        if (bal.code === 'BTC') {
          if (bal.balance > 0) {
            $scope.user_has_btc = true
          } else {
            $scope.user_has_btc = false
          }
        }
      })
    })

    // Switch selectedBalance when balanceIndex is changed (used for carousel with balances)
    $rootScope.$watch('Wallet.selectedBalanceIndex',
      function(newVal) {
        var balances = $rootScope.Wallet.balances;
        if (typeof newVal != 'undefined' && balances[newVal] && balances[newVal].iso != $rootScope.Wallet.selectedBalance.iso) {
          $scope.switchSelectedBalance(balances[newVal]);
        }
      }
    );

    // Page switched
    $rootScope.$on("$stateChangeSuccess", function() {
      if ($state.includes('layout_app.*.receipt')) {
        $rootScope.Wallet.refreshBalances();
      }

      $rootScope.Notifier.resume();
    });


    $scope.openAddressModal = function(address, $event) {
      Modal.show({
        controller: 'CryptoAddressModalCtrl',
        templateUrl: 'modules/layout/_crypto_address.modal.html',
        targetEvent: $event,
        resolve: {
          address: function () {
            return address;
          }
        }
      });
    };

    function updateConvStatus () {
      TetherApi.getConvStatus()
      .success(function(resp) {
        $rootScope.conv_disabled = resp.data.conv_disabled
      });
    }
    updateConvStatus()

    function updateAcquiresStatus () {
      TetherApi.getAcquiresStatus()
      .success(function(resp) {
        $rootScope.acquires_disabled = resp.data.acquires_disabled
      });
    }
    updateAcquiresStatus()

    function updateRedeemsStatus () {
      TetherApi.getRedeemsStatus()
      .success(function(resp) {
        $rootScope.redeems_disabled = resp.data.redeems_disabled
      });
    }
    updateRedeemsStatus()

    function updateExpressWireStatus () {
      TetherApi.getExpressWireStatus()
      .success(function (resp) {
        $rootScope.express_wire_disabled = resp.data.express_wire_disabled
      })
    }
    updateExpressWireStatus()
  }]);

'use strict';

angular.module('tetherApp')
  .controller('CryptoAddressModalCtrl', ["$scope", "address", "Modal", function ($scope, address, Modal) {
    /**
    * FIXME LATER
    * $scope.address = address;
    */
    $scope.address = 'Not Available';

    $scope.close = function() {
      Modal.dismiss();
    }
  }]);

'use strict';

// This is dependency for jquery iframe resizer.
// put it here to not spread temp code over the project.
(function( jQuery ) {
  var matched,
    userAgent = navigator.userAgent || "";
  jQuery.uaMatch = function( ua ) {
    ua = ua.toLowerCase();
    var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
      /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
      /(opera)(?:.*version)?[ \/]([\w.]+)/.exec( ua ) ||
      /(msie) ([\w.]+)/.exec( ua ) ||
      ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+))?/.exec( ua ) ||
      [];
    return {
      browser: match[ 1 ] || "",
      version: match[ 2 ] || "0"
    };
  };

  matched = jQuery.uaMatch( userAgent );

  jQuery.browser = {};

  if ( matched.browser ) {
    jQuery.browser[ matched.browser ] = true;
    jQuery.browser.version = matched.version;
  }

  // Deprecated, use jQuery.browser.webkit instead
  // Maintained for back-compat only
  if ( jQuery.browser.webkit ) {
    jQuery.browser.safari = true;
  }

}( jQuery ));

angular.module('tetherApp')
  .controller('KycCtrl', ["$scope", "$window", "Modal", "TetherApi", "User", function ($scope, $window, Modal, TetherApi, User) {

  }]);

'use strict';

angular.module('tetherApp')
  .controller('SignupCtrl', ["$scope", "$rootScope", "$window", "$stateParams", "$state", "User", "TetherApi", "AmbisafeModel", "base64", "APP_URL", "CMS_URL", "TIMEZONES", "GEO_BLOCKING", "EMAIL_REGEXP", "COUNTRIES", "STATES", "Modal", "$http", function ($scope, $rootScope, $window, $stateParams, $state,
                                      User, TetherApi, AmbisafeModel, base64,
                                      APP_URL, CMS_URL, TIMEZONES,
                                      GEO_BLOCKING, EMAIL_REGEXP, COUNTRIES, STATES, Modal, $http) {

    $scope.EMAIL_REGEXP = EMAIL_REGEXP;
    $scope.countriesList = COUNTRIES;
    $scope.geoBlocking = {enabled: false, countries: [], states: []};

    if (GEO_BLOCKING.enabled) {
      $scope.geoBlocking = GEO_BLOCKING;
    }

    $scope.countrySearch = function(query) {
      return query ? $scope.model.countries.filter( $scope.createFilterFor(query) ) : [];
    };

    $scope.stateSearch = function(query) {
      var available_states = $scope.model.statesList[$scope.model.country.code];
      return query ? available_states.filter( $scope.createFilterForState(query) ) : [];
    };

    // Builds countries list
    $scope.loadAllCountries = function() {
      return $scope.countriesList.map( function (item) {
        if ($scope.geoBlocking.countries.indexOf(item.name) == -1) {
          return {
            value: item.name.toLowerCase(),
            code: item.code,
            display: item.name
          };
        }
      });
    };

    $scope.createFilterForState = function(query) {
      var lowercaseQuery = angular.lowercase(query);
      return function filterFn(item) {
        var name = angular.lowercase(item.name);
        return (item && name.indexOf(lowercaseQuery) === 0);
      };
    };

    // Search country or state for match query
    $scope.createFilterFor = function(query) {
      var lowercaseQuery = angular.lowercase(query);
      return function filterFn(item) {
        //return (country.value.search(lowercaseQuery) >= 0);
        // Next one is faster but search only from string beginning.
        return (item && item .value.indexOf(lowercaseQuery) === 0);
      };
    };

    $scope.showBlockedCountriesPopup = function($event) {
      Modal.show({
        controller: 'GeoCtrl',
        targetEvent: $event,
        templateUrl: 'modules/guest/geo.modal.html'
      });
    };

    $scope.model = {
      firstname: '',
      lastname: '',
      username: '',
      email: '',
      password: '',
      passwordConfirm: '',
      passStrength: '',
      claimToken: $scope.$storage.claimToken,
      claimTokenInfo: $scope.$storage.claimTokenInfo,
      inProgress: false,
      CMS_URL: CMS_URL,

      // Countries
      countries: $scope.loadAllCountries(),
      countrySearchText: '',
      selectedCountry: null,
      // Selectize
      country: "",
      countriesList: COUNTRIES,
      statesList: {},

      // States auto-complete
      states: {},
      stateSearchText: '',
      selectedState: null,
      // Value for text input
      state: ''
    };

    // Prepare list of states for selectize
    angular.forEach(STATES, function(states_by_country, country_code) {
      $scope.model.statesList[country_code] = [];

      angular.forEach(states_by_country, function(state) {
        $scope.model.statesList[country_code].push(state);
      });
    });

    // Prepare list of states
    angular.forEach(STATES, function(states_by_country, country_code) {
      $scope.model.states[country_code] = [];

      angular.forEach(states_by_country, function(state) {
        if ($scope.geoBlocking.states.indexOf(state.name) > -1)
          return;
        $scope.model.states[country_code].push({
          value: state.name.toLowerCase(),
          code: state.code,
          display: state.name
        });
      });
    });

    /**
     * Get timezone code by offset
     * @param offset
     * @returns {string}
     */
    var getTimezoneCodeByOffset = function(offset) {
      var minutes = offset % 60;
      var hours = (offset - minutes) / 60;
      var timeString = hours.toString() + ":" + (minutes < 10 ? '0' : '') + minutes.toString();
      var result = '';

      // Toggle +/- and add "0" for hours
      if (timeString[2] == ':') {
        timeString = (timeString.slice(0, 1) == '-' ? '+' : '-')  + '0' + timeString.slice(1);
      }

      angular.forEach(TIMEZONES, function(timezone) {
        if (timeString == timezone.name.substr(4, 6) && !result) {
          result = timezone.code;
        }
      });

      return result;
    };



    var clearClaimToken = function() {
      delete $scope.$storage.claimToken;
      delete $scope.$storage.claimTokenInfo;
    };

    // Returns State value to send to register backend controller.
    $scope.getStateValue = function() {
      if (!$scope.model.statesList[$scope.model.country.code]) {
        return $scope.model.state;
      } else {
        if ($scope.model.selectedState) {
          return $scope.model.selectedState.name;
        } else {
          return "";
        }
      }
    };

    // Returns Country value to send to register backend controller.
    $scope.getCountryValue = function() {
      if ($scope.model.country) {
        return $scope.model.country.code;
      }
    };

    /**
     * Check if state is blocked
     * @param state
     * @returns {boolean}
     */
    $scope.stateBlocked = function(state) {
      return $scope.geoBlocking.states.indexOf(state.name) >= 0;
    };

    /**
     * Signup process
     */
    $scope.signupProcess = function() {
      $scope.model.inProgress = true;
      TetherApi.recaptchaVerify($scope.model.myRecaptchaResponse)
        .success(function(resp){
          var
            walletContainer = AmbisafeModel.generateAccount($scope.model.password).getStringContainer(),
            passwordHash = AmbisafeModel.deriveKey($scope.model.password),
            rawPassword = $scope.model.password,
            data = {
              firstname: $scope.model.firstname,
              lastname: $scope.model.lastname,
              username: $scope.model.username,
              email: $scope.model.email,
              password: passwordHash,
              password_confirmation: passwordHash,
              wallet_container: base64.encode(walletContainer),
              agreed_tos: 1,
              timezone: getTimezoneCodeByOffset(new Date().getTimezoneOffset()),
              country: $scope.getCountryValue(),
              state: $scope.getStateValue()
            };

          if ($scope.model.claimToken) {
            data.claim_token = $scope.model.claimToken;
          }

          clearClaimToken();
          $rootScope.Notifier.pause();

          TetherApi.signup({user: data})
            .success(function(resp){
              TetherApi.clearCache('all');

              if (resp.status=="success") {
                // Needed for getting Ambisafe account
                $rootScope.$storage.rawPassword = rawPassword;

                // FIXME (needed to set cookie is_authorized=1 for root domain)
                $window.location = APP_URL + '/dashboard?first_login=1';
              } else {
                $scope.model.inProgress = false;
                $rootScope.Notifier.resume();
              }
            })
            .error(function(){
              $scope.model.inProgress = false;
              $rootScope.Notifier.resume();
              $rootScope.Notifier.show('error');
            });

        })
        .error(function(){
          $scope.model.inProgress = false;
        });
      };

      function updateSignupStatus () {
        TetherApi.getSignupStatus()
        .success(function(resp) {
          $rootScope.signup_disabled = resp.data.signup_disabled
        });
      }
      updateSignupStatus()

  }]);

'use strict';

angular.module('tetherApp')
  .controller('PasswordResetCtrl', ["$scope", "$rootScope", "$state", "$stateParams", "$window", "TetherApi", "AmbisafeModel", "base64", "PASSWORD_REGEXP", function ($scope, $rootScope, $state, $stateParams, $window, TetherApi, AmbisafeModel, base64, PASSWORD_REGEXP) {

    $scope.model = {
      password: '',
      passwordConfirm: '',
      passStrength: '',
      twoFactorAuthCode: '',
      inProgress: false
    };

    $scope.PASSWORD_REGEXP = PASSWORD_REGEXP;

    $scope.init = function() {
      try {
        $scope.params = JSON.parse(base64.decode($stateParams.code));
        $scope.validatePasswordResetToken();
      }
      catch(e) {
        $rootScope.Notifier.show('error', 'Wrong parameters', 'Error');
        $state.go('layout_guest.password');
        return;
      }
    };

    $scope.validatePasswordResetToken = function(){
      TetherApi.validatePasswordResetToken($scope.params.token)
        .success(function(resp) {
          if (!resp.success) {
            $state.go('layout_guest.password');
            return;
          }
        });
    };

    $scope.passwordResetProcess = function() {
      $scope.model.inProgress = true;
      var
        walletContainer = AmbisafeModel.generateAccount($scope.model.password).getStringContainer(),
        passwordHash = AmbisafeModel.deriveKey($scope.model.password);
      TetherApi.resetPassword(passwordHash, base64.encode(walletContainer), $scope.params.token, $scope.model.twoFactorAuthCode)
        .success(function(resp) {
          if (resp.success) {
            if (resp.migration_required) {
              $scope.simplePasswordResetProcess();
              return;
            }

            $rootScope.Notifier.show('success', resp.message);
            $state.go('layout_guest.login');
            return;
          }

          $rootScope.Notifier.show('error', resp.error);

          $scope.model.inProgress = false;
          $scope.$$childHead && $scope.$$childHead.passwordResetForm.$setPristine();
          $scope.model.twoFactorAuthCode = '';
        })
        .error(function() {
          $rootScope.Notifier.show('error');
          $scope.model.inProgress = false;
        });
    };

    $scope.simplePasswordResetProcess = function() {
      TetherApi.simpleResetPassword($scope.model.password, $scope.model.passwordConfirm, $scope.params.token, $scope.model.twoFactorAuthCode)
        .success(function(resp) {
          if (resp.success) {
            $rootScope.Notifier.show('success', resp.message);
            $state.go('layout_guest.login');
            return;
          }

          $rootScope.Notifier.show('error', resp.error);

          $scope.model.inProgress = false;
          $scope.$$childHead && $scope.$$childHead.passwordResetForm.$setPristine();
          $scope.model.twoFactorAuthCode = '';
        })
        .error(function() {
          $rootScope.Notifier.show('error');
          $scope.model.inProgress = false;
        });
    };

    $scope.init();

  }]);

'use strict';

angular.module('tetherApp')
  .controller('PasswordCtrl', ["$scope", "$state", "TetherApi", "User", "EMAIL_REGEXP", function ($scope, $state, TetherApi, User, EMAIL_REGEXP) {

    $scope.model = {
      email: '',
      inProgress: false
    };

    $scope.EMAIL_REGEXP = EMAIL_REGEXP;
    $scope.passwordResetProcess = function() {
      $scope.model.inProgress = true;

      TetherApi.restorePassword($scope.model.email)
        .success(function(resp){
          $scope.model.inProgress = false;
          $scope.model.email = '';
          $scope.$$childHead.passwordForm.$setPristine();
          $state.go('layout_guest.login');
        })
        .error(function(resp){
          $scope.model.inProgress = false;
        });
    };

  }]);

'use strict';


angular.module('tetherApp')
  .controller('LogoutCtrl', ["$scope", "$state", "TetherApi", "User", function ($scope, $state, TetherApi, User) {

    TetherApi.logout()
      .success(function() {
        User.logout();
        $state.go('layout_guest.login', {}, {reload: true});
      });

  }]);


'use strict';

angular.module('tetherApp')
  .controller('LoginCtrl', ["$scope", "$rootScope", "$state", "TetherApi", "AmbisafeModel", "base64", function ($scope, $rootScope, $state, TetherApi, AmbisafeModel, base64) {
    $scope.$root = $rootScope
    $scope.model = {
      login: '',
      password: '',
      inProgress: false
    };

        
    $scope.$watch('model.verification', function() {
      if ($scope.model.verification) {
        if (($rootScope.twofa_type != 'google_auth' && $scope.model.verification.length === 7) || ($rootScope.twofa_type == 'google_auth' && $scope.model.verification.length === 6)) {
          $scope.loginProcess()
        }
      }
    })

    $scope.twofa_type_google = false

    $scope.loginProcess = function() {
      $scope.model.inProgress = true;

      var
        passwordHash = AmbisafeModel.deriveKey($scope.model.password),
        rawPassword = $scope.model.password;

      var data = {
        'login': $scope.model.login,
        'password': passwordHash,
        'code': $scope.model.verification
      };

      $scope.credentials = {'login': $scope.model.login, 'password': passwordHash}

      if ($scope.$storage.claimToken) {
        data.user = {claim_token: $scope.$storage.claimToken};
        delete $scope.$storage.claimToken;
      }

      $rootScope.Notifier.pause();

      TetherApi.login(data)
        .success(function(resp) {
          
          TetherApi.clearCache('all');
          $rootScope.twofa_type = resp.twofa_type
          if (resp.twofa_type == 'google_auth') {
            $scope.twofa_type_google = true
          }

          if (resp.two_factor_auth_enabled){
            $scope.two_factor_auth_enabled = true

            if (!$scope.model.verification) {
              $scope.model.inProgress = false;
              return;
            }
          }

          if (resp.migration_required) {
            $scope.migrateUserProcess();
            return;
          }

          if (resp.geo_blocked) {
            TetherApi.clearCache('TetherApi.getGeoInfo');
            $state.go('layout_guest.geo');
          }

          if (resp.status=="success") {
            // Needed for getting Ambisafe account
            $rootScope.$storage.rawPassword = rawPassword;
            $state.go('layout_app.send_funds');
          } else {
            $scope.model.inProgress = false;
            $rootScope.Notifier.resume();
          }
        })
        .error(function() {
          $rootScope.Notifier.resume();
          $scope.model.inProgress = false;
        });
    };

    $scope.migrateUserProcess = function() {
      var
        rawPassword = $scope.model.password,
        passwordHash = AmbisafeModel.deriveKey($scope.model.password),
        walletContainer = AmbisafeModel.generateAccount($scope.model.password).getStringContainer();

      var data = {
        login: $scope.model.login,
        password: passwordHash,
        rawPassword: rawPassword,
        walletContainer: base64.encode(walletContainer)
      };

      TetherApi.migrate(data)
        .success(function(resp) {
          if (resp.status=="success") {
            $scope.loginProcess();
          } else {
            $scope.model.inProgress = false;
            $rootScope.Notifier.resume();
          }
        })
        .error(function() {
          $rootScope.Notifier.resume();
          $scope.model.inProgress = false;
        });
    };

    function updateConvStatus () {
      TetherApi.getConvStatus()
      .success(function(resp) {
        $rootScope.conv_disabled = resp.data.conv_disabled
      });
    }
    updateConvStatus()

  }]);

'use strict';

angular.module('tetherApp')
  .controller('InviteCtrl', ["$scope", "$rootScope", "$window", "TetherApi", "User", "$state", function ($scope, $rootScope, $window, TetherApi, User, $state) {

    $scope.model = {
      email: '',
      inProgress: false
    };

    $scope.inviteProcess = function() {
      $scope.model.inProgress = true;

      TetherApi.requestInvite($scope.model.email)
        .success(function(resp){
          $scope.model.inProgress = false;
          $scope.model.email = '';
          $scope.$$childHead.inviteForm.$setPristine();
          setTimeout(function(){
            $state.go('layout_guest.login')
          }, 3000);
        })
        .error(function(resp){
          $scope.model.inProgress = false;
        });
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('GeoCtrl', ["$scope", "$rootScope", "$window", "$state", "TetherApi", "User", "Modal", "GEO_BLOCKING", function ($scope, $rootScope, $window, $state, TetherApi, User, Modal, GEO_BLOCKING) {

    $scope.geoBlocking = {enabled: false, countries: [], states: []};

    if (GEO_BLOCKING.enabled) {
      $scope.geoBlocking = GEO_BLOCKING;
    }

    $scope.showBlockedCountriesPopup = function($event) {
      Modal.show({
        controller: 'GeoCtrl',
        targetEvent: $event,
        templateUrl: 'modules/guest/geo.modal.html'
      });
    };

    // Reset cache and reload page
    $scope.tryAgain = function() {
      TetherApi.clearCache('TetherApi.getGeoInfo');
      $state.go('layout_guest.login');
    };

    $scope.closeModal = function() {
      Modal.close();
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('ClaimCtrl', ["$scope", "$rootScope", "$stateParams", "$window", "APP_URL", "TetherApi", "User", function ($scope, $rootScope, $stateParams, $window, APP_URL, TetherApi, User) {
    var token = $stateParams.token;

    if (!token) {
      $window.location = '#!/login';
      return;
    }

    if (!User.isGuest()) {
      // Do we need this code?
      TetherApi.claim(token)
        .success(function(resp){
          if (resp.success) {
            setTimeout(function(){
              $rootScope.Notifier.show('success', 'You claimed your funds. Redirecting...');
              $window.location = resp.redirect_to;
            }, 2000);
          } else {
            $window.location = APP_URL;
          }
        })
        .error(function(){
          $window.location = APP_URL;
        });
    } else {
      TetherApi.claim(token)
        .success(function(resp){
          $rootScope.$storage.claimToken = token;
          $rootScope.$storage.claimTokenInfo = resp.info;
          $window.location = '#!/signup';
        })
        .error(function(){
          $rootScope.Notifier.show('error', 'Wrong claim code. Redirecting...');
          setTimeout(function(){
            $window.location = APP_URL;
          },4000);
        });
    }

  }]);

'use strict';

angular.module('tetherApp')
  .controller('DepositWireCtrl', ["$rootScope", "$scope", "$state", "TetherApi", "Wallet", "ACQUIRE_SETTINGS", "$stateParams", function ($rootScope, $scope, $state, TetherApi, Wallet, ACQUIRE_SETTINGS, $stateParams) {
    $scope.acquireNotices = ['geo_block', 'two_factor_auth', 'email_verified', 'btc_currency', 'kyc_pending', 'kyc_verified', 'acquires_disabled'];
    $scope.currencyIso = '';

    $scope.minimalAmount = ACQUIRE_SETTINGS.minimal_amount;

    TetherApi.getAccount().then(function(data) {
      $scope.account_type = data.data.data.account_type
    })
    
    TetherApi.getCompliance().then(function(data) {
      $scope.user_bk_info = data.data.data
    })

    if ($stateParams.model) {
      $scope.model = $stateParams.model;
    }

    $scope.calculateFee = function () {
      var amount = $scope.model.amount || 0;
      $scope.model.fee = Math.max(ACQUIRE_SETTINGS.wire_price, amount * ACQUIRE_SETTINGS.wire_percent / 100);
      $scope.model.totalAmount = amount + $scope.model.fee;
    };

    $scope.acquireCurrencies = function(){
      return function(value){
        return value.tethered;
      }
    };

    $scope.continue = function () {
      $scope.model.inProgress = true;
      if ($scope.depositWireForm.$valid) {
        $state.go("layout_app.deposit_wire.review", {model: $scope.model});
      } else {
        $scope.depositWireForm.amount.$touched = true;
      }
      $scope.model.inProgress = false;
    };

    $scope.confirm = function () {
      $scope.model.inProgress = true;
      if ($scope.depositWireReviewForm.$valid)
        $state.go("layout_app.deposit_wire.info");
      $scope.model.inProgress = false;
    };

    $scope.goBack = function () {
      $state.go('layout_app.deposit_wire.currency', {currency: Wallet.selectedBalance.iso});
    };

    $scope.acquire = function () {
      $scope.model.inProgress = true;
      TetherApi.acquire($scope.model.amount, $scope.currencyIso, $scope.model.token, $scope.model.fee, $scope.model.totalAmount, $scope.model.verification)
        .success(function (result) {
          if (result.status == "success") {
            $state.go("layout_app.deposit_wire.receipt");
          } else {
            // TODO: Refactor
            $scope.depositWireInfoForm.twoFactorAuthForm.twoFactorAuthCode.$error["wrongCode"] = true;
          }
          $scope.model.inProgress = false;
        })
    };

    $scope.restartWire = function () {
      $scope.model.totalAmount = "";
      $scope.model.amount = "";
      $scope.model.verification = "";
      $scope.model.token = 0;
      $scope.model.fee = ACQUIRE_SETTINGS.wire_price;
      $scope.model.confirm = {
        transactionRef: false,
        willSend: false
      };
      TetherApi.getAcquireToken()
        .success(function (result) {
          if (result.status == "success"){
            $scope.model.token = result.data;
            $state.go('layout_app.deposit_wire.currency', {currency: Wallet.selectedBalance.iso});
          }
        });
    };

    $scope.seeActivity = function () {
      $state.go('layout_app.activity')
    };

    $scope.depositQR = function () {
      $state.go('layout_app.deposit')
    };

    $scope.getFeeMessage = function() {
      var currency =  $rootScope.Wallet.selectedBalance;

      return 'We acquire ' +  currency.code
        + ' via international wire transfer. You will pay a fee of 0.1% of the amount acquired, with a minimum of '
        + currency.symbol + ACQUIRE_SETTINGS.wire_price;
    };

    $rootScope.$watch('Wallet.selectedBalance',
      function() {
        $scope.currencyIso = Wallet.selectedBalance.iso;
      }, true);

    $scope.$watch('currencyIso',
      function(newVal) {
        if (newVal)
          Wallet.setSelectedBalance(newVal);
      });

  }]);

'use strict';

angular.module('tetherApp')
  .controller('DepositCtrl', ["$scope", "$state", function ($scope, $state) {

    $scope.depositNotices = ['two_factor_auth', 'geo_block', 'email_verified'];

    $scope.depositWire = function(){
      $state.go('layout_app.deposit_wire')
    }
}]);

'use strict';

angular.module('tetherApp')
  .controller('ConvertReviewCtrl', ["$scope", "$rootScope", "$state", "TetherApi", "AmbisafeModel", function ($scope, $rootScope, $state, TetherApi, AmbisafeModel) {

    $scope.model = {
      selectedFromCurrency: $state.params.selectedFromCurrency,
      selectedToCurrency: $state.params.selectedToCurrency,
      amount: $state.params.amount,
      convertedAmount: $state.params.convertedAmount,

      inProgress: false
    };

    $scope.goBack = function () {
      $state.go('layout_app.convert.currency', {currency: $rootScope.Wallet.selectedBalance.iso});
    };

    $scope.convert = function () {
      $scope.model.inProgress = true;

      TetherApi.convert($scope.model.selectedFromCurrency.code, $scope.model.selectedToCurrency.code, $scope.model.amount)
        .success(function (response) {
          if (response.success) {
            var privateKey = AmbisafeModel.account.data.private_key;
            var transaction = Ambisafe.signTransaction(response.transaction, privateKey);
            TetherApi.finalizeConvert(response.signedTransactionInfo, transaction)
              .success(function (response) {
                if (response.status == 'success') {
                  $rootScope.Notifier.show('success', response.message);
                  $state.go("layout_app.dashboard");
                }
              })
              .error(function (response) {
                $rootScope.Notifier.show('error', response.message);
              });
          } else {
            $rootScope.Notifier.show('error', response.message);
          }
        });
    };
  }]);

'use strict';

angular.module('tetherApp')
  .controller('ConvertCtrl', ["$scope", "$rootScope", "$state", "$filter", "TetherApi", "Wallet", "MINIMAL_BTC_EXCHANGE_AMOUNT", "CONVERT_SUPPORTED_CURRENCIES", function ($scope, $rootScope, $state, $filter, TetherApi, Wallet, MINIMAL_BTC_EXCHANGE_AMOUNT, CONVERT_SUPPORTED_CURRENCIES) {

    $scope.sendNotices = ['two_factor_auth', 'email_verified','geo_block', 'conv_frozen', 'convert_disabled', 'convert_available', 'has_balance_convert'];

    $scope.model = {
      exchangeRate: 1,

      inProgress: false,
      disabledForm: false,

      minExchangeAmount: MINIMAL_BTC_EXCHANGE_AMOUNT,
      maxExchangeAmount: 0.01,
      inputStep: 0.01,
      inputPattern: /^[0-9]+(\.[0-9]{1,2})?$/
    };

    $scope.model.exchangeRates = [];

    $scope.model.currency = {
      btc: 'bitcoin'
    };

    //currencies order is important for setting them in FromCurrency
    $scope.model.supportedCurrencies = CONVERT_SUPPORTED_CURRENCIES;

    $scope.model.balances = getBalance(Wallet.balances);

    $rootScope.$watch('Wallet.balances', updateBalance);

    initCurrencies($scope.model.balances);
    initExchangeRates()
      .then(function(){
        if($scope.model.selectedFromCurrency && $scope.model.selectedToCurrency) {
          updateExchangeRate();
          updateInputLimitFields();

          $rootScope.$watch('Wallet.selectedBalance', changedChoosenBaseCurrency, true);
          $scope.$watch('model.selectedFromCurrency', changedFromCurrency);
          $scope.$watch('model.selectedToCurrency', changedToCurrency);
          $scope.$watch('model.exchangeRate', $scope.changedAmount);
        }
      });

    // ctor
    function initCurrencies(currencies){
      var currentCurrencyIso;

      currentCurrencyIso = resolveBaseCurrency(Wallet.selectedBalance, currencies);

      if (currentCurrencyIso) {
        $scope.model.selectedFromCurrency = getCurrency(currentCurrencyIso, currencies);
        $scope.model.selectedToCurrency = getNextCurrency(currentCurrencyIso, currencies);

        updateFromAvailableCurrencies(currencies);
        updateToAvailableCurrencies(currencies, $scope.model.selectedFromCurrency, $scope.model.selectedToCurrency);
      }
    }

    function initExchangeRates() {
      return TetherApi.getExchangeRates()
        .success(function(result){
          $scope.model.exchangeRates = result;
        });
    }

    //Event handlers
    $scope.changedAmount = function () {
      if($scope.convertForm.amount.$pristine)
        return;

      if ($scope.model.amount && $scope.model.exchangeRate) {
        $scope.model.convertedAmount = $scope.model.amount * $scope.model.exchangeRate;
      } else {
        $scope.model.convertedAmount = 0;
      }
    };

    $scope.confirm = function () {
      $scope.model.inProgress = true;

      // Get account balances
      $scope.model.balances = getBalance(Wallet.balances);
      //validate user has funds
      angular.forEach($scope.model.balances, function (elem) {
        if (elem.iso === $scope.model.selectedFromCurrency.iso) {
          if (elem.balance >= $scope.model.amount) {

            $state.go("layout_app.convert.review", {
              selectedFromCurrency: $scope.model.selectedFromCurrency,
              selectedToCurrency: $scope.model.selectedToCurrency,
              amount: $scope.model.amount,
              convertedAmount: $scope.model.convertedAmount
            });

          } else {
            $rootScope.Notifier.show('error', "Not enough funds");
            $scope.model.inProgress = false;
          }
        }
      });
    };

    function changedChoosenBaseCurrency(newValue, oldValue) {
      if (newValue === oldValue) return;

      var currentCurrencyIso, currencies;

      currencies = $scope.model.balances;
      currentCurrencyIso = resolveBaseCurrency(newValue, currencies);

      if(currentCurrencyIso) {
        $scope.model.selectedFromCurrency = getCurrency(currentCurrencyIso, currencies);
        $scope.model.selectedToCurrency = getNextCurrency(currentCurrencyIso, currencies);
      }

      updateExchangeRate();
      updateInputLimitFields();
      updateToAvailableCurrencies();
    }

    function updateBalance(newValue, oldValue) {
      if (newValue === oldValue) return;

      $scope.model.balances = getBalance(newValue);

      updateFromAvailableCurrencies();
      updateToAvailableCurrencies();
    }

    function changedFromCurrency(newValue, oldValue) {
      if(!angular.isDefined(newValue) || !angular.isDefined(newValue)) {
        return;
      }

      if (oldValue.iso === newValue.iso) {
        return;
      }

      if ($scope.model.selectedToCurrency.iso === oldValue.iso) {
        return;
      }

      $scope.model.selectedToCurrency = oldValue;

      updateExchangeRate();
      updateInputLimitFields();
      updateToAvailableCurrencies();
    }
    function changedToCurrency(newValue, oldValue) {
      if(!angular.isDefined(newValue) || !angular.isDefined(newValue)) {
        return;
      }

      if (oldValue.iso === newValue.iso) {
        return;
      }

      if ($scope.model.selectedFromCurrency.iso === oldValue.iso) {
        return;
      }

      $scope.model.selectedFromCurrency = oldValue;

      updateExchangeRate();
      updateInputLimitFields();
      updateToAvailableCurrencies();
    }

    //Private methods
    function getCurrency(currencyIso, currencies) {
      var currency = null;
      currencies.some(function (elem, i) {
        if (elem.iso === currencyIso) {
          currency = elem;
          return true;
        }
      });

      return currency;
    }

    function getNextCurrency(currencyIso, currencies) {
      var len = currencies.length;
      var currentCurrencyIndex = -1;

      currencies.some(function (elem, i) {
        if (elem.iso === currencyIso) {
          currentCurrencyIndex = i;
          return true;
        }
      });

      if (currentCurrencyIndex === -1) {
        console.log('Convert.Controller.getNextCurrency. Current currency has not been found, iso ' + currencyIso);
        return null;
      }

      if (len > currentCurrencyIndex + 1) {
        return currencies[currentCurrencyIndex + 1];
      } else {
        return currencies[0];
      }
    }

    function getExchangeRate(fromCurrencyCode, toCurrencyCode, exchangeRates) {
      var rate = 0;

      exchangeRates.some(function (elem, i) {
        if (elem.source_currency === fromCurrencyCode && elem.target_currency === toCurrencyCode) {
          rate = elem.exchange_rate;
          return true;
        }
      });

      if (rate === 0) {
        console.log('ConvertCtrl.getExchangeRate. Couldnt find exchange rate from ' + fromCurrencyCode + ' to ' + toCurrencyCode + '.');
      }

      return rate;
    }

    function getBalance(balance) {
      var result = [];

      angular.forEach(balance, function(elem){
        if ($scope.model.supportedCurrencies.indexOf(elem.iso) >= 0) {

          elem.isAnyBalance = function () {
            return parseFloat(this.balance) > 0;
          };

          result.push(elem);
        }
      });

      return result;
    }

    function getBalanceByIso (iso, balances) {
      var balance = {};

      balances.some(function (elem, i) {
        if (elem.iso === iso) {
          balance = elem;
          return true;
        }
      });

      return balance;
    }

    function resolveBaseCurrency (choosenCurrencyIso, currencies) {
      if (!$scope.model.supportedCurrencies.some(function (elem) {
          return elem === choosenCurrencyIso;
        })) {
        choosenCurrencyIso = $scope.model.supportedCurrencies[0];
      }

      var choosenCurrency = getCurrency(choosenCurrencyIso, currencies);

      if (choosenCurrency.isAnyBalance()) {
        return choosenCurrency.iso;
      } else {
        var supportedCurrenciesInOrder = $scope.model.supportedCurrencies;

        for (var i = 0; i < supportedCurrenciesInOrder.length; i++) {
          choosenCurrency = getCurrency(supportedCurrenciesInOrder[i], currencies);

          if(choosenCurrency.isAnyBalance()) {
            return choosenCurrency.iso;
          }
        }
      }

      return null;
    }

    function updateExchangeRate () {
      $scope.model.exchangeRate = getExchangeRate(
        $scope.model.selectedFromCurrency.code,
        $scope.model.selectedToCurrency.code,
        $scope.model.exchangeRates);
    }

    function updateInputLimitFields () {
      var btcCode = getBalanceByIso($scope.model.currency.btc, $scope.model.balances).code;

      if ($scope.model.selectedFromCurrency.code === btcCode) {
        $scope.model.minExchangeAmount = MINIMAL_BTC_EXCHANGE_AMOUNT;
      }
      else {
        $scope.model.minExchangeAmount = (MINIMAL_BTC_EXCHANGE_AMOUNT / getExchangeRate($scope.model.selectedFromCurrency.code, btcCode, $scope.model.exchangeRates));
      }

      $scope.model.minExchangeAmount = $scope.model.minExchangeAmount.toFixed($scope.model.selectedFromCurrency.precision);

      $scope.model.maxExchangeAmount = $scope.model.selectedFromCurrency.balance;

      $scope.model.inputStep = Math.pow(10, -$scope.model.selectedFromCurrency.precision);
      $scope.model.inputPattern = new RegExp('^[0-9]+(\.[0-9]{1,' + $scope.model.selectedFromCurrency.precision + '})?$');
    }

    function updateFromAvailableCurrencies () {
      $scope.model.fromAvailableCurrencies = $filter('filter')($scope.model.balances, function(elem) { return elem.isAnyBalance(); } );
    }

    function updateToAvailableCurrencies () {
      if ($scope.model.selectedFromCurrency && $scope.model.selectedFromCurrency) {
        $scope.model.toAvailableCurrencies = $filter('filter')($scope.model.balances, function(elem) {
          var isFromCurrency = $scope.model.selectedFromCurrency.iso === elem.iso;
          var isChoosenToCurrency = $scope.model.selectedToCurrency.iso === elem.iso;

          return (!isFromCurrency && elem.isAnyBalance()) || isChoosenToCurrency;
        });
      }
    }
  }]);

'use strict';

angular.module('tetherApp')
  .controller('ActivityDetailModalCtrl', ["$scope", "$rootScope", "Modal", "TetherApi", "transaction", function ($scope, $rootScope, Modal, TetherApi, transaction) {

    $scope.transaction = transaction;
    $scope.descriptionUrl = "modules/activity/_"+transaction.tx_type+"_description.html";
    $scope.absoluteAmount = Math.abs(transaction.amount);
    $scope.close = function () {
      Modal.dismiss('close');
    };

  }]);

'use strict';

angular.module('tetherApp')
  .controller('ActivityCtrl', ["$scope", "$rootScope", "TetherApi", "Modal", function ($scope, $rootScope, TetherApi, Modal) {
    $scope.ledger = [];
    $scope.activityNotices = ['two_factor_auth', 'email_verified', 'no_activity'];

    $scope.loadLedger = function () {
      if (!$scope.inProgress) {
        $scope.inProgress = true;
        TetherApi.getTransactionsHistory($scope.lastId)
          .success(function (result) {
            angular.forEach(result, function (transaction) {
              if(transaction.transaction_id != null) {
                transaction.url = transaction.currency == 'BTC' ? "http://www.blockchain.info/tx/"  : "http://www.omniexplorer.info/lookuptx.aspx?txid=";
                transaction.url += transaction.transaction_id;
              }
              if(transaction.tx_type == 'adjustment') {
                transaction.tx_type += transaction.amount >= 0 ? '_deposit' : '_withdraw';
              }
              $scope.ledger.push(transaction);
              $scope.lastId = transaction.id;
            });
            $rootScope.$storage.ledger = $scope.ledger;
            $scope.inProgress = false;
          });
      }
    };


    TetherApi.getTransactionsHistory('all')
      .success(function (result) {
        angular.forEach(result, function (transaction) {
          if(transaction.transaction_id != null) {
            transaction.url = transaction.currency == 'BTC' ? "http://www.blockchain.info/tx/"  : "http://www.omniexplorer.info/lookuptx.aspx?txid=";
            transaction.url += transaction.transaction_id;
          }
          if(transaction.tx_type == 'adjustment') {
            transaction.tx_type += transaction.amount >= 0 ? '_deposit' : '_withdraw';
          }
          $scope.ledger.push(transaction);
        });
        $rootScope.$storage.ledger = $scope.ledger;
        $scope.inProgress = false;
      });

    $scope.showDetails = function (transaction, $event) {
      Modal.show({
        controller: 'ActivityDetailModalCtrl',
        templateUrl: 'modules/activity/activity_details.modal.html',
        targetEvent: $event,
        resolve: {
          transaction: function () {
            if(transaction.transaction_id != null) {
              transaction.url = transaction.currency == 'BTC' ? "http://www.blockchain.info/tx/"  : "http://www.omniexplorer.info/lookuptx.aspx?txid=";
              transaction.url += transaction.transaction_id;
            }
            if(transaction.tx_type == 'adjustment') {
              transaction.tx_type += transaction.amount >= 0 ? '_deposit' : '_withdraw';
            }
            return transaction;
          }
        }
      });
    };

    $scope.convertIncomingBtc = function (id, convert) {
      TetherApi.convertIncomingBtc({ledger_id: id, accept: convert})
    }
  }]);

'use strict';

angular.module('tetherApp')
  .controller('2faCtrl', ["$scope", "$rootScope", "$window", "$stateParams", "$state", "User", "TetherApi", "APP_URL", "AUTHY_COUNTRIES", "focus", "APP_STORE_URL", "GOOGLE_PLAY_STORE_URL", "BLACKBERRY_WEBSTORE_URL", "CHROME_WEBSTORE_URL", function ($scope, $rootScope, $window, $stateParams, $state, User, TetherApi, APP_URL, AUTHY_COUNTRIES, focus,
    APP_STORE_URL, GOOGLE_PLAY_STORE_URL, BLACKBERRY_WEBSTORE_URL, CHROME_WEBSTORE_URL) {
    $scope.$root = $rootScope
    $scope.act_twofa_type = undefined

    if (User.isGuest()) {
      $state.go('layout_guest.login');
    }

    $scope.model = {
      inProgress: false,
      step: 1,

      countries: AUTHY_COUNTRIES,
      phone: '',
      code: '',
      clear_phone_code: '',

      webstore_links: {
        app_store: APP_STORE_URL,
        google_play: GOOGLE_PLAY_STORE_URL,
        blackberry: BLACKBERRY_WEBSTORE_URL,
        chrome_webstore: CHROME_WEBSTORE_URL
      }
    };

    if ($state.current.name === "layout_guest.2fa" && User.isAuth() && $rootScope.User.account.phone_verified) {
      $state.go('layout_guest.2fa_clear_phone');
    }

    if ($state.current.name == "layout_guest.2fa_disable") {
      $scope.model.inProgress = true
      if (!$rootScope.User.account.two_factor_auth_type) {
        $state.go('layout_app.settings.profile')
      } else {
        $scope.model.inProgress = false
      }
      /*TetherApi.disable2fa()
        .success(function(){
          focus("clear_phone_code");
        });*/
    }

    $scope.$watch('model.clear_phone_code', function (value) {
      if (value && value.toString().length === 7) {
        $scope.model.inProgress = true;
        TetherApi.clearPhone(value)
          .success(function(resp){
            if (resp.success) {
              // reload account data
              $rootScope.User.refreshAccount(true)
                .success(function() {
                  $state.go('layout_app.settings.profile', {}, {reload: true});
                })
                .error(function() {
                  $scope.model.inProgress = false;
                });
            } else {
              $rootScope.Notifier.show('error');
              $scope.model.inProgress = false;
            }
          })
          .error(function(){
            $scope.model.inProgress = false;
          });
      }
    });

    $scope.$watch('model.disable_google2fa', function (value) {
      if (value && value.toString().length === 6) {
        $scope.model.inProgress = true;
        TetherApi.disableGoogle2fa(value)
          .success(function(resp){
            if (resp.success) {
              // reload account data
              $rootScope.User.refreshAccount(true)
                .success(function() {
                  $state.go('layout_app.settings.profile', {}, {reload: true});
                })
                .error(function() {
                  $scope.model.inProgress = false;
                });
            } else {
              $rootScope.Notifier.show('error');
              $scope.model.inProgress = false;
            }
          })
          .error(function(){
            $scope.model.inProgress = false;
          });
      }
    })

    $scope.$watch('model.code', function (value) {
      if (value && value.toString().length === 7) {
        $scope.process();
      }
    });

    $scope.process = function() {
      // First screen. Enter country and phone number
      if ($scope.model.step == 1) {
        $scope.model.inProgress = true;

        var data = {
          country_code: $scope.model.country.code,
          authy_cellphone: $scope.model.phone
        };

        TetherApi.register2faPhone(data)
          .success(function(resp){
            if (resp.success) {
              $scope.model.code = '';
              $scope.model.step = 2;
            } else {
              $rootScope.Notifier.show('error', resp.message);
            }
            $scope.model.inProgress = false;
          })
          .error(function(){
            $scope.model.inProgress = false;
            $rootScope.Notifier.show('error');
          });
      }

      // Second step or text sms - enter validation token
      if ($scope.model.step == 2 || $scope.model.step == 3) {
        $scope.model.inProgress = true;
        TetherApi.confirmSms($scope.model.code)
          .success(function(resp){
            if (resp.success) {
              $rootScope.Notifier.show('success', 'Success! Your phone has been confirmed! Redirecting...');

              // Reload account data
              $rootScope.User.refreshAccount(true)
                .success(function() {
                  $state.go('layout_app.settings.profile', {}, {reload: true});
                });
            } else {
              $scope.model.inProgress = false;
              $rootScope.Notifier.show('error', 'The token you entered is invalid');
            }
          })
          .error(function(){
            $scope.model.inProgress = false;
            $rootScope.Notifier.show('error');
          });
      }
    };

    $scope.sendTextSms = function() {
      TetherApi.sendSms(true)
        .success(function(resp){
          setTimeout(function(){
            focus("code");
          },500);
          if (resp.response.success) {
            $rootScope.Notifier.show('success', resp.response.message);
          } else {
            $rootScope.Notifier.show('error', resp.response.message);
          }
        })
        .error(function(){
          $rootScope.Notifier.show('error');
        });
    };

    $scope.change_2fa_type = function(val) {
      $scope.act_twofa_type = undefined
      if (val === 'authy') {
        $scope.model.phone = ''
        $scope.model.country = ''
      } else if (val === 'google') {
        $scope.model.google_code = ''
      }

    }

    $scope.select_2fa_type = function (type) {
      $scope.act_twofa_type = type
      if (type === 'google') {
        TetherApi.setGoogle2fa().success(function(resp){
          var data = resp.data
          $scope.qrcode = data.url
          $scope.key = data.key.secret
          $scope.qrcode_img = '<img alt="Google Authenticator QR Code" src="' + $scope.qrcode + '" style="margin-top: 12px; margin-bottom: 8px;">'
        })
        .error(function(err){
        });
      }
    }

    $scope.g2fa_process = function() {
      $scope.model.inProgress = true;
      TetherApi.activateGoogle2fa($scope.model.google_code)
        .success(function(resp){
          if (resp.status === 'success') {
            $rootScope.Notifier.show('success', 'Success! Your phone has been confirmed! Redirecting...');

            // Reload account data
            $rootScope.User.refreshAccount(true)
              .success(function() {
                $state.go('layout_app.settings.profile', {}, {reload: true});
              });
          } else {
            $scope.model.inProgress = false;
            $rootScope.Notifier.show('error', 'The token you entered is invalid');
          }
        })
        .error(function(){
          $scope.model.inProgress = false;
          $rootScope.Notifier.show('error');
        });
    };

  }]);

'use strict';

angular.module('tetherApp')
  .factory('Wallet', ["$rootScope", "$q", "TetherApi", "Repeater", function ($rootScope, $q, TetherApi, Repeater) {

    var
      balances = [],
      selectedBalance = {},
      selectedBalanceIndex = 0;

    return {
      balances: balances,
      selectedBalance: selectedBalance,
      selectedBalanceIndex: selectedBalanceIndex,

      init: function() {
        // Run auto-update of balances
        Repeater.run('balances',
          function() {
            $rootScope.Wallet.refreshBalances(true);
          }, 60000);

        return $q.all([
          $rootScope.Wallet.refreshBalances()
        ]);
      },

      refreshBalances: function (clearCache) {
        if (clearCache)
          TetherApi.clearCache('TetherApi.getBalances');

        return TetherApi.getBalances()
          .success(function (resp) {
            if (resp.status == 'success')
              $rootScope.Wallet.balances = resp.data;
              var selectedBalanceIso = $rootScope.$storage.selectedBalanceIso || $rootScope.Wallet.balances[0].iso;
              $rootScope.Wallet.setSelectedBalance(selectedBalanceIso);
          });
      },

      setSelectedBalance: function(iso) {
        $rootScope.Wallet.balances.some(function(balance, index) {
          if (balance.iso == iso) {
            $rootScope.Wallet.selectedBalance = balance;
            $rootScope.Wallet.selectedBalanceIndex = index;
            $rootScope.$storage.selectedBalanceIso = iso;
            return true;
          }
        });
      },

      getBalanceByIso: function(iso) {
        var result = {};

        $rootScope.Wallet.balances.some(function(balance) {
          if (balance.iso == iso) {
            result = balance;
            return true;
          }
        });

        return result;
      }

    };
  }]);

'use strict';

angular.module('tetherApp')
  .factory('User', ["$rootScope", "$q", "$cookies", "$state", "$window", "TetherApi", "Wallet", "Repeater", "APP_URL", "APP_AUTH_FLAG", function User($rootScope, $q, $cookies, $state, $window,
                                 TetherApi, Wallet, Repeater,
                                 APP_URL, APP_AUTH_FLAG) {
    var
      account = {},
      unwatchAuthCookie;

    return {
      account: account,

      init: function() {
        // Logout user if his password got lost
        if (angular.isUndefined($rootScope.$storage.rawPassword)) {
          TetherApi.logout()
            .success(function() {
              $rootScope.User.logout();
              $state.go('layout_guest.login', {}, {reload: true});
            });
        }

        // Run auto-update of user account
        Repeater.run('account',
          function() {
            $rootScope.User.refreshAccount(true);
          }, 60000);

        // Watch auth cookie and logout
        unwatchAuthCookie = $rootScope.$watch(
          function () {
            return $cookies.get(APP_AUTH_FLAG);
          },
          function (newVal, oldVal) {
            if (angular.isUndefined(newVal) && oldVal) {
              TetherApi.logout()
                .success(function () {
                  $rootScope.User.logout();
                  $state.go('layout_guest.login', {}, {reload: true});
                });
            }
          });

        return $q.all([
          $rootScope.User.refreshAccount(true)
        ]);
      },

      refreshAccount: function(clearCache) {
        if (clearCache)
          TetherApi.clearCache('TetherApi.getAccount');

        return TetherApi.getAccount()
          .success(function(resp) {
            if (resp.status == 'success')
              $rootScope.User.account = resp.data;
          });
      },

      logout: function () {
        Repeater.stop('account');
        Repeater.stop('balances');

        TetherApi.clearCache('TetherApi.getGeoInfo');
        $rootScope.$storage.$reset();
        unwatchAuthCookie();
      },

      isGuest: function () {
        return true;
      },

      isAuth: function () {
        return false;
      },

      clearAuthFlag: function () {
        delete $cookies[APP_AUTH_FLAG];
      },

      redirectAuthorized: function () {
        if (!this.isGuest()) {
          this.clearAuthFlag();
          $window.location = APP_URL;
        }
      },

      redirectGeoBlocked: function () {
        TetherApi.getGeoInfo()
          .success(function (resp) {
            if (resp.blocked)
              $state.go('layout_guest.geo')
          });
      }

    };
  }]);

'use strict';

angular.module('tetherApp')
  .factory('TetherApi', ["$rootScope", "$http", "CacheFactory", function($rootScope, $http, CacheFactory) {

    /**
     * Query wrapper
     */
    var _query = function(params) {
      params = angular.extend({
        auth: true,
        method: '',
        url: '',
        cache: ''
      }, params);

      var http_params = {
        method: params.method,
        url: '/' + params.url,
        data: params.data || null
      };

      if (params.cache) {
        http_params.cache = CacheFactory.get(params.cache);
      }

      return $http(http_params).error(function(result){
          if (result.message) {
            $rootScope.Notifier.show('error', result.message, 'Error');
          } else {
            $rootScope.Notifier.show('error', 'Oops, something went wrong. Please try again later', 'Error');
          }
      });
    };

    /**
     * Cache settings
     */
    var caches = {
      'TetherApi.getAccount': {maxAge: 60000},
      'TetherApi.getCompliance': {maxAge: 60000},
      'TetherApi.getBalances': {maxAge: 60000},
      'TetherApi.getGeoInfo': {maxAge: 60000},
      'TetherApi.getApiKeys': {maxAge: 60000},
      'TetherApi.getExchangeRates': {maxAge: 60000},
      'TetherApi.getTransactionsHistory': {maxAge: 60000}
    };

    angular.forEach(caches, function(options, id) {
      CacheFactory.createCache(id, options);
    });

    var _clearCache = function(cacheId) {
      if (cacheId == 'all') {
        angular.forEach(caches, function(options, id) {
          var cache = CacheFactory.get(id);
          if (cache)
            cache.removeAll();
        });

        return;
      }

      var cache = CacheFactory.get(cacheId);

      if (cache)
        cache.removeAll();
    };

    return {
      clearCache: _clearCache,

      login: function(data) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'sessions.json',
          data: data
        });
      },

      signup: function(data) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'users.json',
          data: data
        });
      },

      migrate: function(data) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'user/migrate.json',
          data: data
        });
      },

      logout: function() {
        return _query({
          auth: false,
          method: 'GET',
          url: 'logout.json'
        });
      },

      restorePassword: function(email) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'password/forgot.json',
          data: {
            'email': email
          }
        });
      },

      validatePasswordResetToken: function(token){
        return _query({
          method: 'POST',
          url: 'password/validate_reset_password_token.json',
          data: {
            reset_token: token
          }
        });
      },

      resetPassword: function(passwordHash, walletContainer, token, code) {
        return _query({
          method: 'POST',
          url: 'password/reset.json',
          data: {
            password: passwordHash,
            password_confirmation: passwordHash,
            wallet_container: walletContainer,
            reset_token: token,
            code: code
          }
        });
      },

      simpleResetPassword: function(password, passwordConfirmation, token, code) {
        return _query({
          method: 'POST',
          url: 'password/reset.json',
          data: {
            password: password,
            password_confirmation: passwordConfirmation,
            reset_token: token,
            code: code
          }
        });
      },

      requestInvite: function(email) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'request_invite.json',
          data: {
            'email': email
          }
        });
      },

      userExists: function(field, value) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'users/exists.json',
          data: {
            field: field,
            value: value
          }
        });
      },

      claim: function(token) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'claim.json',
          data: {
            token: token
          }
        });
      },

      getGeoInfo: function() {
        return _query({
          method: 'GET',
          url: 'geo.json',
          cache: 'TetherApi.getGeoInfo'
        });
      },

      getTransactionsHistory: function(id) {
        var params = '';

        if (id == 'all') {
          params = '?all=1';
        }
        else if (id) {
          params = '?start_from=' + id;
        }

        return _query({
          method: 'GET',
          url:'ledger.json' + params,
          cache: 'TetherApi.getTransactionsHistory'
        });
      },

      convertIncomingBtc: function(data){
        return _query({
          method: 'POST',
          url: 'convert_incoming_btc.json',
          data: data
        });
      },

      getAccount: function() {
        return _query({
          method: 'GET',
          url: 'account.json',
          cache: 'TetherApi.getAccount'
        });
      },

      getConvStatus: function() {
        return _query({
          method: 'GET',
          url: 'account/conversions_status.json',
          cache: 'TetherApi.getConvStatus'
        });
      },

      getSignupStatus: function() {
        return _query({
          method: 'GET',
          url: 'account/signup_status.json',
          cache: 'TetherApi.getSignupStatus'
        });
      },

      getAcquiresStatus: function() {
        return _query({
          method: 'GET',
          url: 'account/acquires_status.json',
          cache: 'TetherApi.getAcquiresStatus'
        });
      },

      getRedeemsStatus: function() {
        return _query({
          method: 'GET',
          url: 'account/redeems_status.json',
          cache: 'TetherApi.getRedeemsStatus'
        });
      },

      getExpressWireStatus: function () {
        return _query({
          method: 'GET',
          url: 'account/express_wire_status.json',
          cache: 'TetherApi.getExpressWireStatus'
        })
      },

      updateAccount: function(data) {
        _clearCache('TetherApi.getAccount');

        return _query({
          method: 'POST',
          url: 'account.json',
          data: data
        });
      },

      getCompliance: function() {
        return _query({
          method: 'GET',
          url: 'compliance.json',
          cache: 'TetherApi.getCompliance'
        });
      },

      getAmbisafeUserContainer: function() {
        return _query({
          method: 'GET',
          url: 'ambisafe/user_container.json'
        });
      },

      updatePassword: function(data) {
        return _query({
          method: 'POST',
          url: 'user/update_password.json',
          data: data
        });
      },

      sendEmailVerification: function() {
        return _query({
          method: 'POST',
          url: 'send_email_verification.json'
        });
      },

      getBalances: function() {
        return _query({
          method: 'GET',
          url: 'balance.json',
          cache: 'TetherApi.getBalances'
        });
      },

      getApiKeys: function(twoFactorAuthCode) {
        return _query({
          method: 'GET',
          url: 'api_keys.json' + (twoFactorAuthCode ? '?code=' + twoFactorAuthCode : ''),
          cache: 'TetherApi.getApiKeys'
        });
      },

      createApiKey: function(permissions) {
        _clearCache('TetherApi.getApiKeys');

        return _query({
          method: 'POST',
          url: 'api_keys.json',
          data: {
            data: JSON.stringify({permissions: permissions})
          }
        });
      },

      activateApiKey: function(keyId, code, twoFactorAuthCode) {
        _clearCache('TetherApi.getApiKeys');

        return _query({
          method: 'POST',
          url: 'api_keys/activate.json',
          data: {
            id: keyId,
            confirmation: code,
            code: twoFactorAuthCode
          }
        });
      },

      sendActivationCode: function(keyId) {
        return _query({
          method: 'POST',
          url: 'api_keys/send_activation_code.json',
          data: {
            id: keyId
          }
        });
      },

      updateApiKey: function(keyId, permissions, twoFactorAuthCode) {
        _clearCache('TetherApi.getApiKeys');

        return _query({
          method: 'PUT',
          url: 'api_keys/' + keyId + '.json',
          data: {
            data: JSON.stringify({permissions: permissions}),
            code: twoFactorAuthCode
          }
        });
      },

      deleteApiKey: function(keyId, twoFactorAuthCode) {
        _clearCache('TetherApi.getApiKeys');

        return _query({
          method: 'DELETE',
          url: 'api_keys/' + keyId + '.json',
          data: {
            code: twoFactorAuthCode
          }
        });
      },

      sendTokenSms: function(token, force) {
        return _query({
          method: 'GET',
          url: 'password/request_sms_by_token.json?reset_token=' + token + (force ? '&force=true' : '')
        });
      },

      sendSms: function(force) {
        return _query({
          method: 'GET',
          url: 'account/request_sms.json' + (force ? '?force=true' : '')
        });
      },

      sendSmsAsUnlogged: function(login, password, force) {
        return _query({
          method: 'POST',
          url: 'password/request_sms_by_user.json', 
          data: {login: login, password: password, force: force}
        });
      },

      register2faPhone: function(data) {
        return _query({
          method: 'POST',
          url: 'account/register_phone.json',
          data: data
        });
      },

      disable2fa: function() {
        return _query({
          method: 'POST',
          url: 'account/disable_2fa.json'
        });
      },

      clearPhone: function(code) {
        return _query({
          method: 'POST',
          url: 'account/clear_phone.json',
          data: {
            code: code
          }
        });
      },

      setGoogle2fa: function() {
        return _query({
          method: 'GET',
          url: 'account/set_google_2fa.json'
        });
      },

      activateGoogle2fa: function(code) {
        return _query({
          method: 'POST',
          url: 'account/activate_google_2fa.json',
          data: {
            code: code
          }
        });
      },

      disableGoogle2fa: function(code) {
        return _query({
          method: 'POST',
          url: 'account/disable_google_2fa.json',
          data: {
            code: code
          }
        });
      },
      
      // Phone confirmation
      confirmSms: function(code) {
        return _query({
          method: 'POST',
          url: 'account/confirm_sms.json',
          data: {
            code: code
          }
        });
      },

      checkInviteCode: function(code) {
        return _query({
          method: 'POST',
          url: 'is_valid_invite_code.json',
          data: {
            code: code
          }
        });
      },

      validateSend: function(recipient, amount, currency, memo) {
          return _query({
              method: 'POST',
              url: 'tether/send_currency.json',
              data:{
                  recipient:recipient,
                  amount: amount,
                  currency: currency,
                  message: memo
              }
          })
      },

      checkRecipient: function(recipient, currency) {
        return _query({
          method: 'POST',
          url: 'tether/check_recipient.json',
          data:{
            recipient:recipient,
            currency: currency
          }
        })
      },

      initiateSend: function(recipient, amount, currency, message, code){
        return _query({
          method: 'POST',
          url: 'tether/initiate_send.json',
          data: {
            code: code,
            recipient: recipient,
            amount: amount,
            currency: currency,
            message: message
          }
        })
      },

      finalizeSend: function(signedTransactionInfo, transactionUserSigned){
        return _query({
          method: 'POST',
          url: 'tether/finalize_send.json',
          data: {
            signedTransactionInfo: signedTransactionInfo,
            transaction: transactionUserSigned
          }
        })
      },

      getRedeemToken: function(){
        return _query({
          method: 'GET',
          url: "redeem.json"
        });
      },

      redeem: function(amountWire, currencyCode, isExpress, token, verification) {
        return _query({
          method: 'POST',
          url: 'tether/redeeming.json',
          data:{
            code: verification,
            amount: amountWire,
            token: token,
            redeem_method: "wire", // TODO: Add PayPal
            currency_code: currencyCode,
            express: isExpress
          }
        })
      },

      finalizeRedeem: function(signedTransactionInfo, transactionUserSigned){
        return _query({
          method: 'POST',
          url: 'tether/finalize_redeem.json',
          data: {
            signedTransactionInfo: signedTransactionInfo,
            transaction: transactionUserSigned
          }
        })
      },

      acquire: function(amount, currency, token, fee, total, verification){
        return _query({
          method: 'POST',
          url: 'tether/create_acquire.json',
          data:{
            code: verification,
            amount: amount,
            transaction_fee: fee,
            total_transfer_amount: total,
            transaction_id: token,
            currency_iso: currency
          }
        });
      },

      getAcquireToken: function(){
        return _query({
          method: 'GET',
          url: "acquire.json"
        });
      },

      getExchangeRates: function(){
        return _query({
          method: 'GET',
          url: 'api/v1/exchange_rates.json',
          cache: 'TetherApi.getExchangeRates'
        });
      },

      convert: function(currencyFrom, currencyTo, amount){
        return _query({
         method: 'POST',
         url: 'tether/create_exchange_order.json',
         data:{
           currency_from: currencyFrom,
           currency_to: currencyTo,
           amount: amount
         }
        });
      },

      finalizeConvert: function(signedTransactionInfo, transactionUserSigned){
        return _query({
          method: 'POST',
          url: 'tether/finalize_exchange_order.json',
          data: {
            signedTransactionInfo: signedTransactionInfo,
            transaction: transactionUserSigned
          }
        })
      },

      recaptchaVerify: function(response) {
        return _query({
          auth: false,
          method: 'POST',
          url: 'users/check_valid_recaptcha.json',
          data: {
            response: response
          }
        })
      }
    }
  }]);

'use strict';

angular.module('tetherApp')
  .factory('AmbisafeModel', ["$rootScope", "$q", "TetherApi", function ($rootScope, $q, TetherApi) {
    var account = {};

    return {
      account: account,

      init: function() {
        return $q.all([
          $rootScope.AmbisafeModel.getAccount($rootScope.$storage.rawPassword)
        ]);
      },

      generateAccount: function(password, salt, currency) {
        var
          currency = currency || Ambisafe.currency.BITCOIN,
          salt = salt || Ambisafe.SHA1(password);

        return Ambisafe.generateAccount(currency, password, salt);
      },

      deriveKey: function(password, salt, iterations) {
        var
          salt = salt || Ambisafe.SHA1(password),
          iterations = iterations || 2000;

        return Ambisafe.deriveKey(password, salt, iterations)
      },

      getAccount: function(password) {
        return TetherApi.getAmbisafeUserContainer()
          .success(function(resp) {
            if (resp.status == 'success') {
              $rootScope.AmbisafeModel.account = new Ambisafe.Account(resp.data, password);
            }
          });
      }
    };
  }]);

'use strict';

angular.module('tetherApp')
  .config(["$stateProvider", "$urlRouterProvider", "$locationProvider", function($stateProvider, $urlRouterProvider, $locationProvider) {

    $locationProvider.html5Mode(false);
    $locationProvider.hashPrefix('!');

    $urlRouterProvider.otherwise('/login');

    $stateProvider
      /**
       * Routes for Guest
       */
      .state('layout_guest', {
        abstract: true,
        views: {
          'root': {
            templateUrl: 'modules/layout/layout_guest.html',
            controller: 'LayoutGuestCtrl'
          }
        }
      })

      .state('layout_guest.login', {
        url: '/login',
        templateUrl: 'modules/guest/login.html',
        controller: 'LoginCtrl',
        isPublic: true,
        guestOnly: true
      })
      .state('layout_guest.signup', {
        url: '/signup',
        templateUrl: 'modules/guest/signup.html',
        controller: 'SignupCtrl',
        isPublic: true,
        guestOnly: true
      })
      .state('layout_guest.signupCode', {
        url: '/signup/:inviteCode',
        templateUrl: 'modules/guest/signup.html',
        controller: 'SignupCtrl',
        isPublic: true,
        guestOnly: true
      })

      .state('layout_guest.claim', {
        url: '/claim/:token',
        template: '<ui-view/>',
        controller: 'ClaimCtrl',
        isPublic: true
      })

      .state('layout_guest.password', {
        url: '/password',
        templateUrl: 'modules/guest/password.html',
        controller: 'PasswordCtrl',
        isPublic: true,
        guestOnly: true
      })
      .state('layout_guest.passwordReset', {
        url: '/password/*code',
        templateUrl: 'modules/guest/password_reset.html',
        controller: 'PasswordResetCtrl',
        isPublic: true,
        guestOnly: true
      })
      .state('layout_guest.invite', {
        url: '/invite',
        templateUrl: 'modules/guest/invite.html',
        //controller: 'InviteCtrl',
        controller: ["$state", function($state){
          $state.go('layout_guest.signup');
        }],
        isPublic: true,
        guestOnly: true
      })
      .state('layout_guest.geo', {
        url: '/geo',
        templateUrl: 'modules/guest/geo.html',
        controller: 'GeoCtrl',
        isPublic: true,
        guestOnly: false
      })
      // Use guest layout for 2fa form
      .state('layout_guest.2fa', {
        url: '/2fa',
        templateUrl: 'modules/2fa/2fa.html',
        controller: '2faCtrl',
        isPublic: true,
        guestOnly: false
      })
      .state('layout_guest.2fa_disable', {
        url: '/2fa/2fa_disable',
        templateUrl: 'modules/2fa/2fa_disable.html',
        controller: '2faCtrl',
        isPublic: true,
        guestOnly: false
      })



      /**
       * Routes for Authorized
       */
      .state('layout_app', {
        abstract: true,
        views: {
          'root': {
            templateUrl: 'modules/layout/layout_app.html',
            controller: 'LayoutAppCtrl'
          },
          'sidebar@layout_app' : {
            templateUrl: 'modules/layout/_layout_app_sidebar.html',
            controller: 'LayoutAppCtrl'
          },
          "mobileNavigation@layout_app" : {
            templateUrl: "modules/layout/_mobile_navigation.html"
          }
        },
        resolve: {
          init: ["$q", "$rootScope", function($q, $rootScope) {
            return $q.all([
              $rootScope.User.init(),
              $rootScope.Wallet.init(),
              $rootScope.AmbisafeModel.init()
            ]);
          }]
        }
      })

      // Can be used for redirect to default page
      .state('layout_app.dashboard', {
        url: '/dashboard',
        template: '<ui-view/>',
        controller: ["$scope", "$state", "Wallet", function($scope, $state, Wallet) {
          $state.go('layout_app.send_funds.currency', {currency: Wallet.selectedBalance.iso}, {reload: true, location: true, notify: true});
        }]
      })

      .state('layout_app.logout', {
        url: '/logout',
        template: '<ui-view/>',
        controller: 'LogoutCtrl'
      })

      .state('layout_app.send_funds', {
        url: '/send',
        template: '<ui-view/>',
        controller: ["$scope", "$state", "Wallet", "$rootScope", function($scope, $state, Wallet, $rootScope) {
          var selectedBalanceIso = $rootScope.$storage.selectedBalanceIso || 'usdt';

          $scope.model = {
            recipient: '',
            amount: '',
            memo: '',
            currencyIso: '',
            inProgress: false,
            showWarning: false
          };

          $state.go('layout_app.send_funds.currency', {currency: selectedBalanceIso});
        }]
      })
      .state('layout_app.send_funds.currency', {
        url: '/:currency',
        templateUrl: 'modules/send_funds/send_funds.html',
        controller: 'SendFundsCtrl'
      })
      .state('layout_app.send_funds.review', {
        url: '/review',
        templateUrl: 'modules/send_funds/send_funds_review.html',
        controller: 'SendFundsCtrl'
      })
      .state('layout_app.send_funds.receipt', {
        url: '/receipt',
        templateUrl: 'modules/send_funds/send_funds_receipt.html',
        controller: 'SendFundsCtrl'
      })

      .state('layout_app.withdraw', {
        url: '/withdraw',
        template: '<ui-view/>',
        controller: ["$scope", "$rootScope", "$state", "TetherApi", "WITHDRAW_SETTINGS", function($scope, $rootScope, $state, TetherApi, WITHDRAW_SETTINGS) {
          $scope.model = {
            amount: '',
            fee: WITHDRAW_SETTINGS.wire_price,
            feeMin: WITHDRAW_SETTINGS.wire_price,
            totalAmount: '0',
            currencyIso: '',
            isExpress: false,
            inProgress: false
          };

          TetherApi.getRedeemToken()
            .success(function(result){
              if (result.status == "success"){
                $scope.model.token = result.data;
                $state.go('layout_app.withdraw.currency', {currency: $rootScope.$storage.selectedBalanceIso});
              }
            });
        }]
      })
      .state('layout_app.withdraw.currency', {
        url: '/:currency',
        templateUrl: 'modules/withdraw/withdraw.html',
        controller: 'WithdrawCtrl'
      })
      .state('layout_app.withdraw.review', {
        url: '/review',
        templateUrl: 'modules/withdraw/withdraw_review.html',
        controller: 'WithdrawCtrl'
      })
      .state('layout_app.withdraw.receipt', {
        url: '/receipt',
        templateUrl: 'modules/withdraw/withdraw_receipt.html',
        controller: 'WithdrawCtrl'
      })

      .state('layout_app.deposit', {
        url: '/deposit',
        template: '<ui-view/>',
        controller: ["$scope", "$state", "$rootScope", function($scope, $state, $rootScope) {
          $state.go('layout_app.deposit.currency', {currency: $rootScope.Wallet.selectedBalance.iso});
        }]
      })
      .state('layout_app.deposit.currency', {
        url: '/:currency',
        templateUrl: 'modules/deposit/deposit.html',
        controller: 'DepositCtrl'
      })

      .state('layout_app.deposit_wire', {
        url: '/deposit_wire',
        template: '<ui-view/>',
        controller: ["$scope", "$rootScope", "$state", "TetherApi", function($scope, $rootScope, $state, TetherApi) {
          $scope.model = {
            amount: "",
            fee:"",
            totalAmount:"",
            token:"",
            confirm: {
              transactionRef: false,
              willSend: false
            },
            inProgress:false
          };

          TetherApi.getAcquireToken()
            .success(function (result) {
              if (result.status == "success")
                $scope.model.token = result.data;
            });

          $state.go('layout_app.deposit_wire.currency', {currency: $rootScope.Wallet.selectedBalance.iso});
        }]
      })
      .state('layout_app.deposit_wire.currency', {
        url: '/:currency',
        templateUrl: 'modules/deposit_wire/deposit_wire.html',
        controller: 'DepositWireCtrl'
      })
      .state('layout_app.deposit_wire.review', {
        url: '/review',
        templateUrl: 'modules/deposit_wire/deposit_wire_review.html',
        params: {model: null},
        controller: 'DepositWireCtrl'
      })
      .state('layout_app.deposit_wire.info', {
        url: '/info',
        templateUrl: 'modules/deposit_wire/deposit_wire_info.html',
        controller: 'DepositWireCtrl'
      })
      .state('layout_app.deposit_wire.receipt', {
        url: '/receipt',
        templateUrl: 'modules/deposit_wire/deposit_wire_receipt.html',
        controller: 'DepositWireCtrl'
      })

      /*.state('layout_app.convert', {
        url: '/convert',
        template: '<ui-view/>',
        controller: function($scope, $state, $rootScope) {
          $state.go('layout_app.convert.currency', {currency: $rootScope.Wallet.selectedBalance.iso});
        }
      })
      .state('layout_app.convert.currency', {
        url: '/:currency',
        templateUrl: 'modules/convert/convert.html',
        controller: 'ConvertCtrl'
      })
      .state('layout_app.convert.review', {
        url: '/review',
        params: {
          selectedFromCurrency: {},
          selectedToCurrency: {},
          amount: 0,
          convertedAmount: 0
        },
        templateUrl: 'modules/convert/convert_review.html',
        controller: 'ConvertReviewCtrl'
      })*/

      .state('layout_app.activity', {
        url: '/activity',
        template: '<ui-view/>',
        controller: ["$scope", "$state", function($scope, $state) {
          $state.go('layout_app.activity.currency', {currency: ''});
        }]
      })
      .state('layout_app.activity.currency', {
        url: '/:currency',
        templateUrl: 'modules/activity/activity.html',
        controller: 'ActivityCtrl'
      })

      .state('layout_app.settings', {
        url: '/settings',
        views: {
          '@layout_app' :{
            template: '<ui-view/>',
            controller: ["$scope", "$state", "TIMEZONES", function($scope, $state, TIMEZONES) {
              $scope.model = {
                timezone: TIMEZONES[0].code,
                password: '',
                passwordConfirm: '',
                inProgress: false
              };

              if ($state.is('layout_app.settings')) {
                $state.go('layout_app.settings.profile');
              }
            }]

          },
          "sidebar@layout_app" : {
            templateUrl: "modules/settings/_settings_sidebar.html"
          }
        }
      })

      .state('layout_app.settings.profile', {
        url: '/profile',
        templateUrl: 'modules/settings/profile.html',
        controller: 'SettingsCtrl'
      })
      .state('layout_app.settings.preferences', {
        url: '/preferences',
        templateUrl: 'modules/settings/preferences.html',
        controller: 'SettingsCtrl'
      })
      .state('layout_app.settings.apikeys', {
        url: '/apikeys',
        templateUrl: 'modules/settings/api_keys.html',
        controller: 'SettingsCtrl'
      })
      .state('layout_app.kyc', {
        url: '/kyc',
        templateUrl: 'modules/kyc/kyc.html',
        controller: 'KycCtrl'
      })
    ;
  }]);

'use strict';

/**
 * Environments based configuration
 *
 * All patterns "___var_name" will be replaced with values from config/env/{dev|production|...}.json
 * Gulp task: config.js
 * Usage: gulp build --env=production
 */

angular.module('tetherApp')

  .constant('ENV', 'production')

  .constant('APP_URL', '' || window.location.origin)
  .constant('CMS_URL', '' || 'https://tether.to')

  .constant('GEO_BLOCKING', {"enabled":true,"countries":["Afghanistan","Bosnia and Herzegovina","Korea, Democratic People's Republic of","Ethiopia","Iran","Iraq","Lao People's Democratic Republic","Syrian Arab Republic","Uganda","Vanuatu","Yemen"],"states":["Washington"]})
  .constant('TETHER_LINKS', {"faq":"https://tether.to/faqs/","press":"https://tether.to/press/","about":"https://tether.to/about-us/","privacy_policy":"https://tether.to/legal/#1427840873946-2-1","terms_of_service":"https://tether.to/legal/#1427840437-2-14","api_doc":"http://platform.tether.to/"})

  .constant('APP_AUTH_FLAG', 'is_authorized')

  .constant('EMAIL_REGEXP', /^[-a-z0-9_+\.]+\@([-a-z0-9]+\.)+[a-z0-9]{2,}$/i)
  .constant('NETKI_REGEXP', /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)+([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i)

  .constant('PASSWORD_REGEXP', /^(?=.*[a-z])(?=.*[A-Z])((?=.*\d)|(?=.*(_|[^\w]))).+$/)

  .constant('ACQUIRE_SETTINGS', {"minimal_amount":50,"wire_price":20,"wire_percent":0.1})

  .constant('WITHDRAW_SETTINGS', {"minimal_amount":50000,"wire_price":20,"wire_percent":0.1,"express_wire_price":75,"express_wire_percent":1,"paypal_percent":2})

    .constant('API_PERMISSIONS_LIST', ['create_transaction', 'create_exchange_order', 'read_transactions', 'read_exchange_orders', 'read_balances'])

  .constant('COUNTRIES', [{name:'Afghanistan',code:'AF'},{name:'Aland Islands',code:'AX'},{name:'Albania',code:'AL'},{name:'Algeria',code:'DZ'},{name:'American Samoa',code:'AS'},{name:'Andorra',code:'AD'},{name:'Angola',code:'AO'},{name:'Anguilla',code:'AI'},{name:'Antarctica',code:'AQ'},{name:'Antigua and Barbuda',code:'AG'},{name:'Argentina',code:'AR'},{name:'Armenia',code:'AM'},{name:'Aruba',code:'AW'},{name:'Australia',code:'AU'},{name:'Austria',code:'AT'},{name:'Azerbaijan',code:'AZ'},{name:'Bahamas',code:'BS'},{name:'Bahrain',code:'BH'},{name:'Bangladesh',code:'BD'},{name:'Barbados',code:'BB'},{name:'Belarus',code:'BY'},{name:'Belgium',code:'BE'},{name:'Belize',code:'BZ'},{name:'Benin',code:'BJ'},{name:'Bermuda',code:'BM'},{name:'Bhutan',code:'BT'},{name:'Bolivia',code:'BO'},{name:'Bosnia and Herzegovina',code:'BA'},{name:'Botswana',code:'BW'},{name:'Bouvet Island',code:'BV'},{name:'Brazil',code:'BR'},{name:'British Indian Ocean Territory',code:'IO'},{name:'Brunei Darussalam',code:'BN'},{name:'Bulgaria',code:'BG'},{name:'Burkina Faso',code:'BF'},{name:'Burundi',code:'BI'},{name:'Cambodia',code:'KH'},{name:'Cameroon',code:'CM'},{name:'Canada',code:'CA'},{name:'Cape Verde',code:'CV'},{name:'Cayman Islands',code:'KY'},{name:'Central African Republic',code:'CF'},{name:'Chad',code:'TD'},{name:'Chile',code:'CL'},{name:'China',code:'CN'},{name:'Christmas Island',code:'CX'},{name:'Cocos (Keeling) Islands',code:'CC'},{name:'Colombia',code:'CO'},{name:'Comoros',code:'KM'},{name:'Congo',code:'CG'},{name:'Congo, The Democratic Republic of the',code:'CD'},{name:'Cook Islands',code:'CK'},{name:'Costa Rica',code:'CR'},{name:'Cote D\'Ivoire',code:'CI'},{name:'Croatia',code:'HR'},{name:'Cuba',code:'CU'},{name:'Cyprus',code:'CY'},{name:'Czech Republic',code:'CZ'},{name:'Denmark',code:'DK'},{name:'Djibouti',code:'DJ'},{name:'Dominica',code:'DM'},{name:'Dominican Republic',code:'DO'},{name:'Ecuador',code:'EC'},{name:'Egypt',code:'EG'},{name:'El Salvador',code:'SV'},{name:'Equatorial Guinea',code:'GQ'},{name:'Eritrea',code:'ER'},{name:'Estonia',code:'EE'},{name:'Ethiopia',code:'ET'},{name:'Falkland Islands (Malvinas)',code:'FK'},{name:'Faroe Islands',code:'FO'},{name:'Fiji',code:'FJ'},{name:'Finland',code:'FI'},{name:'France',code:'FR'},{name:'French Guiana',code:'GF'},{name:'French Polynesia',code:'PF'},{name:'French Southern Territories',code:'TF'},{name:'Gabon',code:'GA'},{name:'Gambia',code:'GM'},{name:'Georgia',code:'GE'},{name:'Germany',code:'DE'},{name:'Ghana',code:'GH'},{name:'Gibraltar',code:'GI'},{name:'Greece',code:'GR'},{name:'Greenland',code:'GL'},{name:'Grenada',code:'GD'},{name:'Guadeloupe',code:'GP'},{name:'Guam',code:'GU'},{name:'Guatemala',code:'GT'},{name:'Guernsey',code:'GG'},{name:'Guinea',code:'GN'},{name:'Guinea-Bissau',code:'GW'},{name:'Guyana',code:'GY'},{name:'Haiti',code:'HT'},{name:'Heard Island and Mcdonald Islands',code:'HM'},{name:'Holy See (Vatican City State)',code:'VA'},{name:'Honduras',code:'HN'},{name:'Hong Kong',code:'HK'},{name:'Hungary',code:'HU'},{name:'Iceland',code:'IS'},{name:'India',code:'IN'},{name:'Indonesia',code:'ID'},{name:'Iraq',code:'IQ'},{name:'Ireland',code:'IE'},{name:'Isle of Man',code:'IM'},{name:'Israel',code:'IL'},{name:'Italy',code:'IT'},{name:'Jamaica',code:'JM'},{name:'Japan',code:'JP'},{name:'Jersey',code:'JE'},{name:'Jordan',code:'JO'},{name:'Kazakhstan',code:'KZ'},{name:'Kenya',code:'KE'},{name:'Kiribati',code:'KI'},{name:'Korea, Democratic People\'S Republic of',code:'KP'},{name:'Korea, Republic of',code:'KR'},{name:'Kuwait',code:'KW'},{name:'Kyrgyzstan',code:'KG'},{name:'Lao People\'S Democratic Republic',code:'LA'},{name:'Latvia',code:'LV'},{name:'Lebanon',code:'LB'},{name:'Lesotho',code:'LS'},{name:'Liberia',code:'LR'},{name:'Libyan Arab Jamahiriya',code:'LY'},{name:'Liechtenstein',code:'LI'},{name:'Lithuania',code:'LT'},{name:'Luxembourg',code:'LU'},{name:'Macao',code:'MO'},{name:'Macedonia, The Former Yugoslav Republic of',code:'MK'},{name:'Madagascar',code:'MG'},{name:'Malawi',code:'MW'},{name:'Malaysia',code:'MY'},{name:'Maldives',code:'MV'},{name:'Mali',code:'ML'},{name:'Malta',code:'MT'},{name:'Marshall Islands',code:'MH'},{name:'Martinique',code:'MQ'},{name:'Mauritania',code:'MR'},{name:'Mauritius',code:'MU'},{name:'Mayotte',code:'YT'},{name:'Mexico',code:'MX'},{name:'Micronesia, Federated States of',code:'FM'},{name:'Moldova, Republic of',code:'MD'},{name:'Monaco',code:'MC'},{name:'Mongolia',code:'MN'},{name:'Montserrat',code:'MS'},{name:'Morocco',code:'MA'},{name:'Mozambique',code:'MZ'},{name:'Myanmar',code:'MM'},{name:'Namibia',code:'NA'},{name:'Nauru',code:'NR'},{name:'Nepal',code:'NP'},{name:'Netherlands',code:'NL'},{name:'Netherlands Antilles',code:'AN'},{name:'New Caledonia',code:'NC'},{name:'New Zealand',code:'NZ'},{name:'Nicaragua',code:'NI'},{name:'Niger',code:'NE'},{name:'Nigeria',code:'NG'},{name:'Niue',code:'NU'},{name:'Norfolk Island',code:'NF'},{name:'Northern Mariana Islands',code:'MP'},{name:'Norway',code:'NO'},{name:'Oman',code:'OM'},{name:'Pakistan',code:'PK'},{name:'Palau',code:'PW'},{name:'Palestinian Territory, Occupied',code:'PS'},{name:'Panama',code:'PA'},{name:'Papua New Guinea',code:'PG'},{name:'Paraguay',code:'PY'},{name:'Peru',code:'PE'},{name:'Philippines',code:'PH'},{name:'Pitcairn',code:'PN'},{name:'Poland',code:'PL'},{name:'Portugal',code:'PT'},{name:'Puerto Rico',code:'PR'},{name:'Qatar',code:'QA'},{name:'Reunion',code:'RE'},{name:'Romania',code:'RO'},{name:'Russian Federation',code:'RU'},{name:'RWANDA',code:'RW'},{name:'Saint Helena',code:'SH'},{name:'Saint Kitts and Nevis',code:'KN'},{name:'Saint Lucia',code:'LC'},{name:'Saint Pierre and Miquelon',code:'PM'},{name:'Saint Vincent and the Grenadines',code:'VC'},{name:'Samoa',code:'WS'},{name:'San Marino',code:'SM'},{name:'Sao Tome and Principe',code:'ST'},{name:'Saudi Arabia',code:'SA'},{name:'Senegal',code:'SN'},{name:'Serbia',code:'RS'},{name:'Montenegro',code:'ME'},{name:'Seychelles',code:'SC'},{name:'Sierra Leone',code:'SL'},{name:'Singapore',code:'SG'},{name:'Slovakia',code:'SK'},{name:'Slovenia',code:'SI'},{name:'Solomon Islands',code:'SB'},{name:'Somalia',code:'SO'},{name:'South Africa',code:'ZA'},{name:'South Georgia and the South Sandwich Islands',code:'GS'},{name:'Spain',code:'ES'},{name:'Sri Lanka',code:'LK'},{name:'Sudan',code:'SD'},{name:'Suriname',code:'SR'},{name:'Svalbard and Jan Mayen',code:'SJ'},{name:'Swaziland',code:'SZ'},{name:'Sweden',code:'SE'},{name:'Switzerland',code:'CH'},{name:'Syrian Arab Republic',code:'SY'},{name:'Taiwan',code:'TW'},{name:'Tajikistan',code:'TJ'},{name:'Tanzania, United Republic of',code:'TZ'},{name:'Thailand',code:'TH'},{name:'Timor-Leste',code:'TL'},{name:'Togo',code:'TG'},{name:'Tokelau',code:'TK'},{name:'Tonga',code:'TO'},{name:'Trinidad and Tobago',code:'TT'},{name:'Tunisia',code:'TN'},{name:'Turkey',code:'TR'},{name:'Turkmenistan',code:'TM'},{name:'Turks and Caicos Islands',code:'TC'},{name:'Tuvalu',code:'TV'},{name:'Uganda',code:'UG'},{name:'Ukraine',code:'UA'},{name:'United Arab Emirates',code:'AE'},{name:'United Kingdom',code:'GB'},{name:'United States',code:'US'},{name:'United States Minor Outlying Islands',code:'UM'},{name:'Uruguay',code:'UY'},{name:'Uzbekistan',code:'UZ'},{name:'Vanuatu',code:'VU'},{name:'Venezuela',code:'VE'},{name:'Viet Nam',code:'VN'},{name:'Virgin Islands, British',code:'VG'},{name:'Virgin Islands, U.S.',code:'VI'},{name:'Wallis and Futuna',code:'WF'},{name:'Western Sahara',code:'EH'},{name:'Yemen',code:'YE'},{name:'Zambia',code:'ZM'},{name:'Zimbabwe',code:'ZW'}])
  .constant('STATES', {CA:[{name:'Alberta',code:'AB'},{name:'British Columbia',code:'BC'},{name:'Manitoba',code:'MB'},{name:'New Brunswick',code:'NB'},{name:'Newfoundland',code:'NL'},{name:'Northwest Territories',code:'NT'},{name:'Nova Scotia',code:'NS'},{name:'Nunavut',code:'NU'},{name:'Ontario',code:'ON'},{name:'Prince Edward Island',code:'PE'},{name:'Quebec',code:'QC'},{name:'Saskatchewan',code:'SK'},{name:'Yukon Territory',code:'YT'}],US:[{name:'Alabama',code:'AL'},{name:'Alaska',code:'AK'},{name:'Arizona',code:'AZ'},{name:'Arkansas',code:'AR'},{name:'California',code:'CA'},{name:'Colorado',code:'NC'},{name:'Connecticut',code:'CT'},{name:'Delaware',code:'DE'},{name:'District of Columbia',code:'DC'},{name:'Florida',code:'FL'},{name:'Georgia',code:'GA'},{name:'Hawaii',code:'HI'},{name:'Idaho',code:'ID'},{name:'Illinois',code:'IL'},{name:'Indiana',code:'IN'},{name:'Iowa',code:'IA'},{name:'Kansas',code:'KS'},{name:'Kentucky',code:'KY'},{name:'Louisiana',code:'LA'},{name:'Maine',code:'ME'},{name:'Maryland',code:'MD'},{name:'Massachusetts',code:'MA'},{name:'Michigan',code:'MI'},{name:'Minnesota',code:'Mn'},{name:'Mississippi',code:'MS'},{name:'Missouri',code:'MO'},{name:'Montana',code:'MT'},{name:'Nebraska',code:'NE'},{name:'Nevada',code:'NV'},{name:'New Hampshire',code:'NH'},{name:'New Jersey',code:'NJ'},{name:'New Mexico',code:'NM'},{name:'New York',code:'NY'},{name:'North Carolina',code:'NC'},{name:'North Dakota',code:'ND'},{name:'Ohio',code:'OH'},{name:'Oklahoma',code:'OK'},{name:'Oregon',code:'OR'},{name:'Pennsylvania',code:'PA'},{name:'Rhode Island',code:'RI'},{name:'South Carolina',code:'SC'},{name:'South Dakota',code:'SD'},{name:'Tennessee',code:'TN'},{name:'Texas',code:'TX'},{name:'Utah',code:'UT'},{name:'Vermont',code:'VT'},{name:'Virginia',code:'VA'},{name:'Washington',code:'WA'},{name:'West Virginia',code:'WV'},{name:'Wisconsin',code:'WI'},{name:'Wyoming',code:'WY'}],AU:[{name:'Australian Capital Territory',code:'ACT'},{name:'New South Wales',code:'NSW'},{name:'Northern Territory',code:'NT'},{name:'Queensland',code:'QLD'},{name:'South Australia',code:'SA'},{name:'Tasmania',code:'TAS'},{name:'Victoria',code:'VIC'},{name:'Western Australia',code:'WA'}]})
  .constant('TIMEZONES', [{code:"American Samoa",name:"(GMT-11:00) American Samoa"},{code:"International Date Line West",name:"(GMT-11:00) International Date Line West"},{code:"Midway Island",name:"(GMT-11:00) Midway Island"},{code:"Hawaii",name:"(GMT-10:00) Hawaii"},{code:"Alaska",name:"(GMT-09:00) Alaska"},{code:"Pacific Time (US & Canada)",name:"(GMT-08:00) Pacific Time (US & Canada)"},{code:"Tijuana",name:"(GMT-08:00) Tijuana"},{code:"Arizona",name:"(GMT-07:00) Arizona"},{code:"Chihuahua",name:"(GMT-07:00) Chihuahua"},{code:"Mazatlan",name:"(GMT-07:00) Mazatlan"},{code:"Mountain Time (US & Canada)",name:"(GMT-07:00) Mountain Time (US & Canada)"},{code:"Central America",name:"(GMT-06:00) Central America"},{code:"Central Time (US & Canada)",name:"(GMT-06:00) Central Time (US & Canada)"},{code:"Guadalajara",name:"(GMT-06:00) Guadalajara"},{code:"Mexico City",name:"(GMT-06:00) Mexico City"},{code:"Monterrey",name:"(GMT-06:00) Monterrey"},{code:"Saskatchewan",name:"(GMT-06:00) Saskatchewan"},{code:"Bogota",name:"(GMT-05:00) Bogota"},{code:"Eastern Time (US & Canada)",name:"(GMT-05:00) Eastern Time (US & Canada)"},{code:"Indiana (East)",name:"(GMT-05:00) Indiana (East)"},{code:"Lima",name:"(GMT-05:00) Lima"},{code:"Quito",name:"(GMT-05:00) Quito"},{code:"Caracas",name:"(GMT-04:30) Caracas"},{code:"Atlantic Time (Canada)",name:"(GMT-04:00) Atlantic Time (Canada)"},{code:"Georgetown",name:"(GMT-04:00) Georgetown"},{code:"La Paz",name:"(GMT-04:00) La Paz"},{code:"Santiago",name:"(GMT-04:00) Santiago"},{code:"Newfoundland",name:"(GMT-03:30) Newfoundland"},{code:"Brasilia",name:"(GMT-03:00) Brasilia"},{code:"Buenos Aires",name:"(GMT-03:00) Buenos Aires"},{code:"Greenland",name:"(GMT-03:00) Greenland"},{code:"Mid-Atlantic",name:"(GMT-02:00) Mid-Atlantic"},{code:"Azores",name:"(GMT-01:00) Azores"},{code:"Cape Verde Is.",name:"(GMT-01:00) Cape Verde Is."},{code:"Casablanca",name:"(GMT+00:00) Casablanca"},{code:"Dublin",name:"(GMT+00:00) Dublin"},{code:"Edinburgh",name:"(GMT+00:00) Edinburgh"},{code:"Lisbon",name:"(GMT+00:00) Lisbon"},{code:"London",name:"(GMT+00:00) London"},{code:"Monrovia",name:"(GMT+00:00) Monrovia"},{code:"UTC",name:"(GMT+00:00) UTC"},{code:"Amsterdam",name:"(GMT+01:00) Amsterdam"},{code:"Belgrade",name:"(GMT+01:00) Belgrade"},{code:"Berlin",name:"(GMT+01:00) Berlin"},{code:"Bern",name:"(GMT+01:00) Bern"},{code:"Bratislava",name:"(GMT+01:00) Bratislava"},{code:"Brussels",name:"(GMT+01:00) Brussels"},{code:"Budapest",name:"(GMT+01:00) Budapest"},{code:"Copenhagen",name:"(GMT+01:00) Copenhagen"},{code:"Ljubljana",name:"(GMT+01:00) Ljubljana"},{code:"Madrid",name:"(GMT+01:00) Madrid"},{code:"Paris",name:"(GMT+01:00) Paris"},{code:"Prague",name:"(GMT+01:00) Prague"},{code:"Rome",name:"(GMT+01:00) Rome"},{code:"Sarajevo",name:"(GMT+01:00) Sarajevo"},{code:"Skopje",name:"(GMT+01:00) Skopje"},{code:"Stockholm",name:"(GMT+01:00) Stockholm"},{code:"Vienna",name:"(GMT+01:00) Vienna"},{code:"Warsaw",name:"(GMT+01:00) Warsaw"},{code:"West Central Africa",name:"(GMT+01:00) West Central Africa"},{code:"Zagreb",name:"(GMT+01:00) Zagreb"},{code:"Athens",name:"(GMT+02:00) Athens"},{code:"Bucharest",name:"(GMT+02:00) Bucharest"},{code:"Cairo",name:"(GMT+02:00) Cairo"},{code:"Harare",name:"(GMT+02:00) Harare"},{code:"Helsinki",name:"(GMT+02:00) Helsinki"},{code:"Istanbul",name:"(GMT+02:00) Istanbul"},{code:"Jerusalem",name:"(GMT+02:00) Jerusalem"},{code:"Kyiv",name:"(GMT+02:00) Kyiv"},{code:"Pretoria",name:"(GMT+02:00) Pretoria"},{code:"Riga",name:"(GMT+02:00) Riga"},{code:"Sofia",name:"(GMT+02:00) Sofia"},{code:"Tallinn",name:"(GMT+02:00) Tallinn"},{code:"Vilnius",name:"(GMT+02:00) Vilnius"},{code:"Baghdad",name:"(GMT+03:00) Baghdad"},{code:"Kuwait",name:"(GMT+03:00) Kuwait"},{code:"Minsk",name:"(GMT+03:00) Minsk"},{code:"Moscow",name:"(GMT+03:00) Moscow"},{code:"Nairobi",name:"(GMT+03:00) Nairobi"},{code:"Riyadh",name:"(GMT+03:00) Riyadh"},{code:"St. Petersburg",name:"(GMT+03:00) St. Petersburg"},{code:"Volgograd",name:"(GMT+03:00) Volgograd"},{code:"Tehran",name:"(GMT+03:30) Tehran"},{code:"Abu Dhabi",name:"(GMT+04:00) Abu Dhabi"},{code:"Baku",name:"(GMT+04:00) Baku"},{code:"Muscat",name:"(GMT+04:00) Muscat"},{code:"Tbilisi",name:"(GMT+04:00) Tbilisi"},{code:"Yerevan",name:"(GMT+04:00) Yerevan"},{code:"Kabul",name:"(GMT+04:30) Kabul"},{code:"Ekaterinburg",name:"(GMT+05:00) Ekaterinburg"},{code:"Islamabad",name:"(GMT+05:00) Islamabad"},{code:"Karachi",name:"(GMT+05:00) Karachi"},{code:"Tashkent",name:"(GMT+05:00) Tashkent"},{code:"Chennai",name:"(GMT+05:30) Chennai"},{code:"Kolkata",name:"(GMT+05:30) Kolkata"},{code:"Mumbai",name:"(GMT+05:30) Mumbai"},{code:"New Delhi",name:"(GMT+05:30) New Delhi"},{code:"Sri Jayawardenepura",name:"(GMT+05:30) Sri Jayawardenepura"},{code:"Kathmandu",name:"(GMT+05:45) Kathmandu"},{code:"Almaty",name:"(GMT+06:00) Almaty"},{code:"Astana",name:"(GMT+06:00) Astana"},{code:"Dhaka",name:"(GMT+06:00) Dhaka"},{code:"Novosibirsk",name:"(GMT+06:00) Novosibirsk"},{code:"Urumqi",name:"(GMT+06:00) Urumqi"},{code:"Rangoon",name:"(GMT+06:30) Rangoon"},{code:"Bangkok",name:"(GMT+07:00) Bangkok"},{code:"Hanoi",name:"(GMT+07:00) Hanoi"},{code:"Jakarta",name:"(GMT+07:00) Jakarta"},{code:"Krasnoyarsk",name:"(GMT+07:00) Krasnoyarsk"},{code:"Beijing",name:"(GMT+08:00) Beijing"},{code:"Chongqing",name:"(GMT+08:00) Chongqing"},{code:"Hong Kong",name:"(GMT+08:00) Hong Kong"},{code:"Irkutsk",name:"(GMT+08:00) Irkutsk"},{code:"Kuala Lumpur",name:"(GMT+08:00) Kuala Lumpur"},{code:"Perth",name:"(GMT+08:00) Perth"},{code:"Singapore",name:"(GMT+08:00) Singapore"},{code:"Taipei",name:"(GMT+08:00) Taipei"},{code:"Ulaan Bataar",name:"(GMT+08:00) Ulaan Bataar"},{code:"Osaka",name:"(GMT+09:00) Osaka"},{code:"Sapporo",name:"(GMT+09:00) Sapporo"},{code:"Seoul",name:"(GMT+09:00) Seoul"},{code:"Tokyo",name:"(GMT+09:00) Tokyo"},{code:"Yakutsk",name:"(GMT+09:00) Yakutsk"},{code:"Adelaide",name:"(GMT+09:30) Adelaide"},{code:"Darwin",name:"(GMT+09:30) Darwin"},{code:"Brisbane",name:"(GMT+10:00) Brisbane"},{code:"Canberra",name:"(GMT+10:00) Canberra"},{code:"Guam",name:"(GMT+10:00) Guam"},{code:"Hobart",name:"(GMT+10:00) Hobart"},{code:"Magadan",name:"(GMT+10:00) Magadan"},{code:"Melbourne",name:"(GMT+10:00) Melbourne"},{code:"Port Moresby",name:"(GMT+10:00) Port Moresby"},{code:"Solomon Is.",name:"(GMT+10:00) Solomon Is."},{code:"Sydney",name:"(GMT+10:00) Sydney"},{code:"Vladivostok",name:"(GMT+10:00) Vladivostok"},{code:"New Caledonia",name:"(GMT+11:00) New Caledonia"},{code:"Auckland",name:"(GMT+12:00) Auckland"},{code:"Fiji",name:"(GMT+12:00) Fiji"},{code:"Kamchatka",name:"(GMT+12:00) Kamchatka"},{code:"Marshall Is.",name:"(GMT+12:00) Marshall Is."},{code:"Wellington",name:"(GMT+12:00) Wellington"},{code:"Nuku'alofa",name:"(GMT+13:00) Nuku'alofa"},{code:"Samoa",name:"(GMT+13:00) Samoa"},{code:"Tokelau Is.",name:"(GMT+13:00) Tokelau Is."}])
  .constant('AUTHY_COUNTRIES', [{"country": "United States of America (+1)","code": "1"},{"country": "Canada (+1)","code": "1"},{"country": "Russia (+7)","code": "7"},{"country": "Kazakhstan (+7)","code": "7"},{"country": "Egypt (+20)","code": "20"},{"country": "South Africa (+27)","code": "27"},{"country": "Greece (+30)","code": "30"},{"country": "Netherlands (+31)","code": "31"},{"country": "Belgium (+32)","code": "32"},{"country": "France (+33)","code": "33"},{"country": "Spain (+34)","code": "34"},{"country": "Hungary (+36)","code": "36"},{"country": "Italy (+39)","code": "39"},{"country": "Romania (+40)","code": "40"},{"country": "Switzerland (+41)","code": "41"},{"country": "Austria (+43)","code": "43"},{"country": "United Kingdom (+44)","code": "44"},{"country": "Guernsey (+44)","code": "44"},{"country": "Isle of Man (+44)","code": "44"},{"country": "Jersey (+44)","code": "44"},{"country": "Denmark (+45)","code": "45"},{"country": "Sweden (+46)","code": "46"},{"country": "Norway (+47)","code": "47"},{"country": "Poland (+48)","code": "48"},{"country": "Germany (+49)","code": "49"},{"country": "Peru (+51)","code": "51"},{"country": "Mexico (+52)","code": "52"},{"country": "Cuba (+53)","code": "53"},{"country": "Argentina (+54)","code": "54"},{"country": "Brazil (+55)","code": "55"},{"country": "Chile (+56)","code": "56"},{"country": "Colombia (+57)","code": "57"},{"country": "Venezuela (+58)","code": "58"},{"country": "Malaysia (+60)","code": "60"},{"country": "Australia (+61)","code": "61"},{"country": "Indonesia (+62)","code": "62"},{"country": "Philippines (+63)","code": "63"},{"country": "New Zealand (+64)","code": "64"},{"country": "Singapore (+65)","code": "65"},{"country": "Thailand (+66)","code": "66"},{"country": "Japan (+81)","code": "81"},{"country": "Korea (+South) (+82)","code": "82"},{"country": "Vietnam (+84)","code": "84"},{"country": "China (+86)","code": "86"},{"country": "Turkey (+90)","code": "90"},{"country": "India (+91)","code": "91"},{"country": "Pakistan (+92)","code": "92"},{"country": "Afghanistan (+93)","code": "93"},{"country": "Sri Lanka (+94)","code": "94"},{"country": "Myanmar (+95)","code": "95"},{"country": "Iran (+98)","code": "98"},{"country": "Morocco (+212)","code": "212"},{"country": "Algeria (+213)","code": "213"},{"country": "Tunisia (+216)","code": "216"},{"country": "Libya (+218)","code": "218"},{"country": "Gambia (+220)","code": "220"},{"country": "Senegal (+221)","code": "221"},{"country": "Mauritania (+222)","code": "222"},{"country": "Mali Republic (+223)","code": "223"},{"country": "Guinea (+224)","code": "224"},{"country": "Ivory Coast (+225)","code": "225"},{"country": "Burkina Faso (+226)","code": "226"},{"country": "Niger (+227)","code": "227"},{"country": "Togo (+228)","code": "228"},{"country": "Benin (+229)","code": "229"},{"country": "Mauritius (+230)","code": "230"},{"country": "Liberia (+231)","code": "231"},{"country": "Sierra Leone (+232)","code": "232"},{"country": "Ghana (+233)","code": "233"},{"country": "Nigeria (+234)","code": "234"},{"country": "Chad (+235)","code": "235"},{"country": "Central African Republic (+236)","code": "236"},{"country": "Cameroon (+237)","code": "237"},{"country": "Cape Verde Islands (+238)","code": "238"},{"country": "Sao Tome and Principe (+239)","code": "239"},{"country": "Gabon (+241)","code": "241"},{"country": "Congo, Democratic Republ (+243)","code": "243"},{"country": "Angola (+244)","code": "244"},{"country": "Guinea-Bissau (+245)","code": "245"},{"country": "Seychelles (+248)","code": "248"},{"country": "Sudan (+249)","code": "249"},{"country": "Rwanda (+250)","code": "250"},{"country": "Ethiopia (+251)","code": "251"},{"country": "Somalia (+252)","code": "252"},{"country": "Djibouti (+253)","code": "253"},{"country": "Kenya (+254)","code": "254"},{"country": "Tanzania (+255)","code": "255"},{"country": "Uganda (+256)","code": "256"},{"country": "Burundi (+257)","code": "257"},{"country": "Mozambique (+258)","code": "258"},{"country": "Zambia (+260)","code": "260"},{"country": "Madagascar (+261)","code": "261"},{"country": "Reunion (+262)","code": "262"},{"country": "Zimbabwe (+263)","code": "263"},{"country": "Namibia (+264)","code": "264"},{"country": "Malawi (+265)","code": "265"},{"country": "Lesotho (+266)","code": "266"},{"country": "Botswana (+267)","code": "267"},{"country": "Swaziland (+268)","code": "268"},{"country": "Mayotte Island (+269)","code": "269"},{"country": "Aruba (+297)","code": "297"},{"country": "Faroe Islands (+298)","code": "298"},{"country": "Greenland (+299)","code": "299"},{"country": "Gibraltar (+350)","code": "350"},{"country": "Portugal (+351)","code": "351"},{"country": "Luxembourg (+352)","code": "352"},{"country": "Ireland (+353)","code": "353"},{"country": "Iceland (+354)","code": "354"},{"country": "Albania (+355)","code": "355"},{"country": "Malta (+356)","code": "356"},{"country": "Cyprus (+357)","code": "357"},{"country": "Finland (+358)","code": "358"},{"country": "Bulgaria (+359)","code": "359"},{"country": "Lithuania (+370)","code": "370"},{"country": "Latvia (+371)","code": "371"},{"country": "Estonia (+372)","code": "372"},{"country": "Moldova (+373)","code": "373"},{"country": "Armenia (+374)","code": "374"},{"country": "Belarus (+375)","code": "375"},{"country": "Andorra (+376)","code": "376"},{"country": "Monaco (+377)","code": "377"},{"country": "San Marino (+378)","code": "378"},{"country": "Ukraine (+380)","code": "380"},{"country": "Serbia (+381)","code": "381"},{"country": "Montenegro (+382)","code": "382"},{"country": "Croatia (+385)","code": "385"},{"country": "Slovenia (+386)","code": "386"},{"country": "Bosnia-Herzegovina (+387)","code": "387"},{"country": "Macedonia (+389)","code": "389"},{"country": "Czech Republic (+420)","code": "420"},{"country": "Slovakia (+421)","code": "421"},{"country": "Liechtenstein (+423)","code": "423"},{"country": "Falkland Islands (+500)","code": "500"},{"country": "Belize (+501)","code": "501"},{"country": "Guatemala (+502)","code": "502"},{"country": "El Salvador (+503)","code": "503"},{"country": "Honduras (+504)","code": "504"},{"country": "Nicaragua (+505)","code": "505"},{"country": "Costa Rica (+506)","code": "506"},{"country": "Panama (+507)","code": "507"},{"country": "Haiti (+509)","code": "509"},{"country": "Guadeloupe (+590)","code": "590"},{"country": "Bolivia (+591)","code": "591"},{"country": "Guyana (+592)","code": "592"},{"country": "Ecuador (+593)","code": "593"},{"country": "French Guiana (+594)","code": "594"},{"country": "Paraguay (+595)","code": "595"},{"country": "Martinique (+596)","code": "596"},{"country": "Suriname (+597)","code": "597"},{"country": "Uruguay (+598)","code": "598"},{"country": "Netherlands Antilles (+599)","code": "599"},{"country": "Timor-Leste (+670)","code": "670"},{"country": "Guam (+671)","code": "671"},{"country": "Brunei (+673)","code": "673"},{"country": "Nauru (+674)","code": "674"},{"country": "Papua New Guinea (+675)","code": "675"},{"country": "Tonga (+676)","code": "676"},{"country": "Solomon Islands (+677)","code": "677"},{"country": "Vanuatu (+678)","code": "678"},{"country": "Fiji Islands (+679)","code": "679"},{"country": "Cook Islands (+682)","code": "682"},{"country": "Samoa (+685)","code": "685"},{"country": "New Caledonia (+687)","code": "687"},{"country": "French Polynesia (+689)","code": "689"},{"country": "Korea (+North) (+850)","code": "850"},{"country": "HongKong (+852)","code": "852"},{"country": "Macau (+853)","code": "853"},{"country": "Cambodia (+855)","code": "855"},{"country": "Laos (+856)","code": "856"},{"country": "Bangladesh (+880)","code": "880"},{"country": "International (+882)","code": "882"},{"country": "Taiwan (+886)","code": "886"},{"country": "Maldives (+960)","code": "960"},{"country": "Lebanon (+961)","code": "961"},{"country": "Jordan (+962)","code": "962"},{"country": "Syria (+963)","code": "963"},{"country": "Iraq (+964)","code": "964"},{"country": "Kuwait (+965)","code": "965"},{"country": "Saudi Arabia (+966)","code": "966"},{"country": "Yemen (+967)","code": "967"},{"country": "Oman (+968)","code": "968"},{"country": "Palestine (+970)","code": "970"},{"country": "United Arab Emirates (+971)","code": "971"},{"country": "Israel (+972)","code": "972"},{"country": "Bahrain (+973)","code": "973"},{"country": "Qatar (+974)","code": "974"},{"country": "Bhutan (+975)","code": "975"},{"country": "Mongolia (+976)","code": "976"},{"country": "Nepal (+977)","code": "977"},{"country": "Tajikistan (+992)","code": "992"},{"country": "Turkmenistan (+993)","code": "993"},{"country": "Azerbaijan (+994)","code": "994"},{"country": "Georgia (+995)","code": "995"},{"country": "Kyrgyzstan (+996)","code": "996"},{"country": "Uzbekistan (+998)","code": "998"},{"country": "Bahamas (+1242)","code": "1242"},{"country": "Barbados (+1246)","code": "1246"},{"country": "Anguilla (+1264)","code": "1264"},{"country": "Antigua and Barbuda (+1268)","code": "1268"},{"country": "Virgin Islands, British (+1284)","code": "1284"},{"country": "Cayman Islands (+1345)","code": "1345"},{"country": "Bermuda (+1441)","code": "1441"},{"country": "Grenada (+1473)","code": "1473"},{"country": "Turks and Caicos Islands (+1649)","code": "1649"},{"country": "Montserrat (+1664)","code": "1664"},{"country": "Saint Lucia (+1758)","code": "1758"},{"country": "Dominica (+1767)","code": "1767"},{"country": "St. Vincent and The Gren (+1784)","code": "1784"},{"country": "Puerto Rico (+1787)","code": "1787"},{"country": "Dominican Republic (+1809)","code": "1809"},{"country": "Dominican Republic2 (+1829)","code": "1829"},{"country": "Dominican Republic3 (+1849)","code": "1849"},{"country": "Trinidad and Tobago (+1868)","code": "1868"},{"country": "Saint Kitts and Nevis (+1869)","code": "1869"},{"country": "Jamaica (+1876)","code": "1876"},{"country": "Congo (+2420)","code": "2420"}])

  .constant('MINIMAL_BTC_EXCHANGE_AMOUNT', 0.015)

  .constant('APP_STORE_URL', 'https://itunes.apple.com/en/app/authy/id494168017?mt=8')
  .constant('GOOGLE_PLAY_STORE_URL', 'https://play.google.com/store/apps/details?id=com.authy.authy&hl=en')
  .constant('BLACKBERRY_WEBSTORE_URL', 'http://appworld.blackberry.com/webstore/content/38831914/?countrycode=US&lang=en')
  .constant('CHROME_WEBSTORE_URL', 'https://chrome.google.com/webstore/detail/authy/gaedmjdfmmahhbjefcbgaolhhanlaolb?hl=en')

  .constant('CONVERT_SUPPORTED_CURRENCIES', ['bitcoin', 'usdt'])
;

'use strict';

angular.module('tetherApp')
  .service('Repeater', ["$interval", function ($interval) {

    var runningTasks = {};

    return {

      run: function(id, task, interval, run_immediately) {
        if (run_immediately === true)
          task();

        if (angular.isUndefined(runningTasks[id])) {
          runningTasks[id] = $interval(task, interval);
        }
      },

      stop: function(id) {
        if (angular.isDefined(runningTasks[id])) {
          $interval.cancel(runningTasks[id]);
          runningTasks[id] = undefined;
        }
      }

    };

  }]);

'use strict';

angular.module('tetherApp')
  .service('Notifier', ["$rootScope", "$mdToast", function($rootScope, $mdToast) {

    var isPaused = false;

    return {

      show: function (status, content, title, timeout) {
        var self = this;

        if (timeout == undefined) {
          timeout = 15000;
        }
        if (status == 'error' && (!content || content === undefined)) {
          content = 'Something went wrong. Please try again later.';
        }

        if (self.isPaused()) {
          this.addNotification(status, content, title, timeout);
        } else {
          $mdToast
            .show({
              template: '\
                <div class="toast toast-{{ status }} {{ fadeOutClass }}" ng-click="close()">\
                  <div class="title" ng-if="title">{{ title }}</div>\
                  <div class="content">{{ content }}</div>\
                  <a href="" ng-click="close()" class="close">&times;</a>\
                  <div class="progress" ng-style="{width: progress + \'%\'}"></div>\
                </div>',

              controller: ["$scope", "$mdToast", "$interval", "status", "content", "title", "timeout", function($scope, $mdToast, $interval, status, content, title, timeout) {
                angular.extend($scope, {
                  status: status,
                  content: content,
                  title: title,
                  timeout: timeout,
                  progress: 0,
                  fadeOutClass: ''
                });

                var intervalId;

                if (timeout > 0) {
                  var hideTime = new Date().getTime() + timeout;

                  intervalId = $interval(function() {
                    var time = new Date().getTime();
                    $scope.progress = ((hideTime - time - 1000) / timeout) * 100;

                    if (hideTime - time < 1000) {
                      $scope.fadeOutClass = 'fadeOut';
                    }
                  }, 10, 0);
                }

                $scope.close = function() {
                  $mdToast.hide();
                };

                $scope.progressStop = function() {
                  if (angular.isUndefined(intervalId)) return;

                  $interval.cancel(intervalId);
                  intervalId = undefined;
                };

                $scope.$on('$destroy', function() {
                  $scope.progressStop();
                });
              }],

              locals: {
                status: status,
                content: content,
                title: title,
                timeout: timeout
              },

              hideDelay: timeout
            });
        }
      },

      hide: function() {
        $mdToast.hide();
      },

      addNotification: function (status, content, title, timeout) {
        $rootScope.$storage.deferredNotifications.push({
          status: status,
          content: content,
          title: title,
          timeout: timeout
        });
      },

      isPaused: function () {
        return isPaused;
      },

      pause: function () {
        isPaused = true;
      },

      resume: function () {
        isPaused = false;

        var deferredNotifications = this.getNotifications();
        angular.forEach(deferredNotifications, function (notify) {
          $rootScope.Notifier.show(notify.status, notify.content, notify.title, notify.timeout);
        });

        this.clearDeferredNotifications();
      },

      clearDeferredNotifications: function () {
        $rootScope.$storage.deferredNotifications = [];
      },

      getNotifications: function () {
        return $rootScope.$storage.deferredNotifications;
      }
    };
  }]);

'use strict';

angular.module('tetherApp')
  .service('Modal', ["$mdDialog", function($mdDialog) {

    return {

      show: function (data) {
        var defaults = {
          clickOutsideToClose: true
        };
        return $mdDialog.show(angular.extend({}, defaults, data))
          .then(data['close'] || function(){}, data['dismiss'] || function(){});
      },

      close: function(result) {
        $mdDialog.hide(result);
      },

      dismiss: function(result) {
        $mdDialog.cancel(result);
      }

    };

  }]);

'use strict';

angular.module('tetherApp')
  .service('Helpers', function Helpers() {

    return {

      generateRandomString: function(length) {
        length = length || 10;
        var characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        var result = '';

        for (var i=0; i<length; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        return result;
      }

    };

  });

'use strict';

angular.module('tetherApp')
  .filter('money', ["$filter", "$rootScope", "Wallet", function ($filter, $rootScope, Wallet) {

    return function(input, currency, options) {
      if (typeof input === 'undefined' || input === '' || typeof currency === 'undefined' || currency === '')
        return;

      if (typeof currency != 'object') {
        Wallet.balances.some(function(balance) {
          if ([balance.code, balance.iso, balance.symbol].indexOf(currency) > -1) {
            currency = balance;
            return true;
          }
        });
      }

      var minus_sign = '';
      if (input < 0) {
        input = Math.abs(input);
        minus_sign = '-';
      }
      else if (input > 0 && options && options.showPlus) {
        minus_sign = '+';
      }

      input = Big(input).round(currency.precision, 0).toFixed(currency.precision).toString();

      if (options && options.isShort) {
        return minus_sign + currency.symbol + $filter('number')(input, currency.precision);
      }
      else {
        return minus_sign + currency.symbol + $filter('number')(input, currency.precision) + ' ' + currency.code;
      }
    }

  }]);

'use strict';

angular.module('tetherApp')
  .directive('validRecipient', ["$rootScope", "$http", "TetherApi", "EMAIL_REGEXP", "NETKI_REGEXP", function ($rootScope, $http, TetherApi, EMAIL_REGEXP, NETKI_REGEXP) {

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {

        var bitcore = require("bitcore-lib");

        ctrl.$validators['valid-recipient'] = function (modelValue, viewValue) {
          var value = modelValue || viewValue;
          if (!value)
            return false;
          var validAddress = bitcore.Address.isValid(value);
          var validEmail = EMAIL_REGEXP.test(value);
          var validNetki = NETKI_REGEXP.test(value);
          return validAddress || validEmail || validNetki;
        };

        ctrl.$validators['sending-to-self'] = function (modelValue, viewValue) {
          var value = modelValue || viewValue;
          if (!value)
            return false;
          var user = $rootScope.User.account;
          var sendingToSelf = value == user.deposit_address || value == user.email;
          return !sendingToSelf;
        };
      }
    };
  }]);

'use strict';

angular.module('tetherApp')
  .directive('validInviteCode', ["$http", "TetherApi", function ($http, TetherApi) {

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {

        var delay = 2000,
            timer_id = null;
        // TODO: Use crtl.asyncValidators
        ctrl.$parsers.unshift(function (viewValue) {
          clearTimeout(timer_id);

          timer_id = setTimeout(function(){
            if (!viewValue)
              return;

            TetherApi.checkInviteCode(viewValue)
              .success(function(resp) {
                if (resp.valid) {
                  ctrl.$setValidity('valid-invite-code', true);
                  scope.model.email = resp.email;
                } else {
                  // wrong invite code
                  ctrl.$setValidity('valid-invite-code', false);
                }
              });

          }, delay);

          return viewValue;
        });
      }
    };
  }]);

'use strict';

angular.module('tetherApp')
  .directive('unique', ["$http", "TetherApi", function ($http, TetherApi) {

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {

        var delay = 2000,
            timer_id = null;

        ctrl.$parsers.unshift(function (viewValue) {
          clearTimeout(timer_id);

          timer_id = setTimeout(function(){
            if (!viewValue)
              return;

            TetherApi.userExists(ctrl.$name, viewValue)
              .success(function (resp) {
                if (resp.status == 'success') {
                  ctrl.$setValidity('unique', !resp.exists);
                } else {
                  ctrl.$setValidity('unique', true);
                }
              });
          }, delay);

          return viewValue;
        });
      }
    };
  }]);

'use strict';

angular.module('tetherApp')
  .directive('selectOnClick', function () {
    return {
      restrict: 'A',
      link: function (scope, element) {
        element.on('click', function (e) {
          this.select();
          e.stopPropagation();
        });

        element.attr('readonly', true);
      }
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('positiveNumber', function () {

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {
        function checkForPositive(viewValue){
          if (!isNaN(parseFloat(viewValue)) && viewValue[0] === '-') {
            viewValue = viewValue.substr(1);
            ctrl.$viewValue = viewValue;
            ctrl.$render();
          }

          return viewValue
        }

        ctrl.$parsers.unshift(checkForPositive);
        ctrl.$formatters.unshift(checkForPositive);
      }
    };
  });

'use strict';

// Validates one field to match value of other.
// Usage:
// input(match-field, data-field="field name to match")
angular.module('tetherApp')
  .directive('matchField', function () {

    return {
      restrict: 'A',
      require: 'ngModel',
      link: function (scope, elm, attrs, ctrl) {

        ctrl.$parsers.unshift(function (viewValue) {
          var match_field = attrs['match'];
          var match_value = scope.model[match_field];
          if (match_value != viewValue) {
            ctrl.$setValidity('match-field', false);
            return undefined;
          } else {
            ctrl.$setValidity('match-field', true);
          }
          return viewValue;
        });

      }
    };
  });

'use strict';

angular.module('tetherApp')
  .directive('focusOn', function() {
  return function(scope, elem, attr) {
    scope.$on('focusOn', function(e, name) {
      if(name === attr.focusOn) {
        elem[0].focus();
      }
    });
  };
});

angular.module('tetherApp')
  .factory('focus', ["$rootScope", "$timeout", function ($rootScope, $timeout) {
  return function(name) {
    $timeout(function (){
      $rootScope.$broadcast('focusOn', name);
    });
  }
}]);

'use strict';

angular.module('tetherApp')
  .filter('currency_format', function() {
    return function(input, currencySymbol, currencyCode, precision) {
      var precision = precision || 2;
      var currencySymbol = currencySymbol || '';
      var currencyCode = currencyCode ? ' ' + currencyCode : '';

      if (input !== undefined && input !== '' && input !== null)
        return currencySymbol + input.toFixed(precision) + currencyCode;
      return '';
    }
  })
  .directive('currencyformat', ["$filter", "currency_formatFilter", function ($filter, currency_formatFilter) {
    return {
      require: 'ngModel',
      scope: {
        crSymbol: '=',
        crCode: '=',
        crPrecision: '='
      },
      link: function (scope, elem, attrs, ngModel) {
        ngModel.$formatters.push(function (val) {
          return $filter('currency_format')(val, scope.crSymbol, scope.crCode, scope.crPrecision);
        });
      }
    }
}]);

'use strict';

angular.module('tetherApp')
  .filter('capitalize', function() {
    return function(input) {
      return (!!input) ?
        input.replace(/([^\W_]+[^\s-]*) */g, function(txt){
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }) : '';
    }
  });

'use strict';

angular.module('tetherApp')
.directive('autofillSync', ["$timeout", function($timeout){
  return {
      require: 'ngModel',
      link: function(scope, elem, attrs, ngModel) {
        var origVal = elem.val();
        $timeout(function () {
          var newVal = elem.val();
          if(ngModel.$pristine && newVal !== origVal) {
            ngModel.$setViewValue(newVal);
          }

          elem.removeAttr('readonly');
        }, 500);
      }
   }
}]);
angular.module("tetherApp").run(["$templateCache", function($templateCache) {$templateCache.put("modules/2fa/2fa.form.html","<style>\n  .selectize-input.selectize-focus {\n    border-color: rgba(20,123,88,0.87) !important;\n    border-bottom: 1px solid rgba(20,123,88,0.87) !important;\n  }\n  \n</style><form name=\"TwoFaForm\" ng-submit=\"process()\" novalidate=\"novalidate\"><div ng-if=\"model.step==1\"><div><ui-select ng-model=\"model.country\" reset-search-input=\"true\" required=\"required\"><ui-select-match placeholder=\"Country\">{{ $select.selected.country }}</ui-select-match><ui-select-choices repeat=\"country in model.countries | orderBy: \'+country\' | filter: $select.search\"><div ng-bind-html=\"country.country| highlight: $select.search\"></div></ui-select-choices></ui-select></div><md-input-container><label>Mobile Phone</label> <input type=\"tel\" name=\"phone\" ng-model=\"model.phone\" ng-minlength=\"1\" ng-maxlength=\"250\" ng-pattern=\"/^([0-9][0-9][0-9])W*([0-9][0-9]{2})W*([0-9]{0,5})$/\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"><div ng-messages=\"TwoFaForm.phone.$error\" role=\"alert\" ng-if=\"TwoFaForm.phone.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"pattern\">Enter valid phone number</div></div></md-input-container><md-input-container><md-button type=\"submit\" ng-disabled=\"TwoFaForm.$invalid || model.inProgress\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Enable\' }}</md-button></md-input-container></div><div ng-if=\"model.step==2 || model.step==3\"><div style=\"text-align:center;margin:0 0 30px 0;\">Please install and open <a href=\"https://www.authy.com/users\" target=\"_blank\">Authy app</a> using button below. You will see code in it.</div><div flex=\"100\" layout=\"row\" layout-wrap=\"layout-wrap\"><div flex=\"25\" flex-sm=\"50\" class=\"app-icon\"><a href=\"{{model.webstore_links.app_store}}\" target=\"_blank\" class=\"app-store\"><img src=\"assets/images/webstores/app_store.png\"></a></div><div flex=\"25\" flex-sm=\"50\" class=\"app-icon\"><a href=\"{{model.webstore_links.google_play}}\" target=\"_blank\" class=\"google-play\"><img src=\"assets/images/webstores/google_play.png\"></a></div><div flex=\"25\" flex-sm=\"50\" class=\"app-icon\"><a href=\"{{model.webstore_links.blackberry}}\" target=\"_blank\" class=\"blackberry\"><img src=\"assets/images/webstores/blackberry.png\"></a></div><div flex=\"25\" flex-sm=\"50\" class=\"app-icon\"><a href=\"{{model.webstore_links.chrome_webstore}}\" target=\"_blank\" class=\"extension\"><img src=\"assets/images/webstores/chrome_webstore.png\"></a></div></div><md-input-container><label>Authy verification code</label> <input type=\"tel\" name=\"code\" ng-model=\"model.code\" ng-minlength=\"1\" ng-maxlength=\"250\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" autofocus=\"autofocus\" focus-on=\"code\" ng-disabled=\"model.inProgress\"><div ng-messages=\"TwoFaForm.code.$error\" role=\"alert\" ng-if=\"TwoFaForm.code.$touched\"><div ng-message=\"required\">This field is required</div></div></md-input-container></div><div ng-if=\"model.step==2\" style=\"text-align:center\"><div>Cannot install Authy application? <a href=\"\" ng-click=\"model.step=3;sendTextSms();\">Get code in SMS.</a></div></div><div ng-if=\"model.step==3\" style=\"text-align:center\"><div>Didn\'t get the SMS? <a href=\"\" ng-click=\"sendTextSms()\">Resend the code.</a></div><div><br>If nothing helps - <a href=\"https://tether.to/contact-us/\" target=\"_blank\">please contact our support</a> for manual verification.</div></div><div ng-if=\"model.step==2 || model.step==3\" style=\"text-align:center\"><div><br><a href=\"\" ng-click=\"model.step=1\">â† Change phone number</a></div></div><div ng-if=\"model.step==1\"><br><a href=\"\" ng-click=\"change_2fa_type(\'authy\')\" ng-disabled=\"model.inProgress\">â† Change 2fa type</a></div></form>");
$templateCache.put("modules/2fa/2fa.html","<md-whiteframe layout=\"column\" style=\"padding-bottom: 30px;\" class=\"2fa-page signup-page md-whiteframe-z1\"><h1 class=\"md-headline\">Two-Factor Authentication</h1><div ng-if=\"!act_twofa_type\" style=\"text-align:center;margin-bottom:30px\">For your security, two-factor authentication must be enabled to use Tether</div><md-button type=\"button\" ng-if=\"!act_twofa_type\" ng-click=\"select_2fa_type(\'google\')\" class=\"md-raised md-primary\">Google Authenticator</md-button><md-button type=\"button\" ng-if=\"!act_twofa_type\" ng-click=\"select_2fa_type(\'authy\')\" class=\"md-raised md-primary\">Authy/SMS</md-button><div ng-show=\"act_twofa_type === \'google\'\" ng-include=\"\'modules/2fa/2fa_google.form.html\'\"></div><div ng-show=\"act_twofa_type === \'authy\'\" ng-include=\"\'modules/2fa/2fa.form.html\'\"></div></md-whiteframe>");
$templateCache.put("modules/2fa/2fa_disable.html","<md-whiteframe layout=\"column\" class=\"signup-page md-whiteframe-z1\"><h1 class=\"md-headline\">Two-Factor Authentication</h1><div ng-show=\"$root.User.account.two_factor_auth_type == \'authy\' &amp;&amp; !model.inProgress\" ng-include=\"\'modules/2fa/clear_phone.form.html\'\"></div><div ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\' &amp;&amp; !model.inProgress\" ng-include=\"\'modules/2fa/disable_g2fa.form.html\'\"></div><div ng-show=\"model.inProgress\" style=\"text-align: center; margin-top: 45px; margin-bottom: 45px; font-size: 18px;\">Working...</div></md-whiteframe>");
$templateCache.put("modules/2fa/2fa_google.form.html","<style>\n  .selectize-input.selectize-focus {\n    border-color: rgba(20,123,88,0.87) !important;\n    border-bottom: 1px solid rgba(20,123,88,0.87) !important;\n  }\n  \n</style><form name=\"GoogleTwoFaForm\" ng-submit=\"g2fa_process()\" novalidate=\"novalidate\"><div><div style=\"text-align:center;margin:0 0 30px 0;\">The first step is to download the Google Authenticator app for your Android or iOS device. If you need help getting started, please see <a href=\"http://support.google.com/accounts/bin/answer.py?hl=en&amp;answer=1066447\" target=\"_blank\">Google\'s Support Page.</a></div><div style=\"background-color: rgba(25,139,108,0.1); border-radius: 4px; padding: 8px; margin-bottom: 16px; text-align: center;\"><div>Scan the QR Code and enter the token</div><div ng-bind-html=\"qrcode_img\" style=\"margin-top: 10px; height: 155px;\"></div><div>Account token (Key): {{ key }}</div></div><div style=\"font-size: 13px; font-style: italic; margin-bottom: 16px;\">The token will not be shown again after 2FA is enabled. If you have multiple devices, add your account token to all of them before clicking enable. (Note: Your Account Token will change each time you reload your browser.)</div><md-input-container><label>2fa verification code</label> <input type=\"tel\" name=\"code\" ng-model=\"model.google_code\" ng-minlength=\"1\" ng-maxlength=\"250\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" autofocus=\"autofocus\" focus-on=\"code\" ng-disabled=\"model.inProgress\"><div ng-messages=\"GoogleTwoFaForm.code.$error\" role=\"alert\" ng-if=\"GoogleTwoFaForm.code.$touched\"><div ng-message=\"required\">This field is required</div></div></md-input-container><md-input-container><md-button type=\"submit\" ng-disabled=\"GoogleTwoFaForm.$invalid || model.inProgress\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Enable\' }}</md-button></md-input-container></div><div><br><a href=\"\" ng-click=\"change_2fa_type(\'google\')\" ng-disabled=\"model.inProgress\">â† Change 2fa type</a></div></form>");
$templateCache.put("modules/2fa/clear_phone.form.html","<form name=\"clearPhoneForm\" novalidate=\"novalidate\"><div style=\"text-align:center\">Enter verification code to disable two-factor authentication<br><br></div><md-input-container><label>Authy verification code</label> <input type=\"tel\" name=\"clear_phone_code\" ng-model=\"model.clear_phone_code\" ng-minlength=\"1\" ng-maxlength=\"250\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" autofocus=\"autofocus\" focus-on=\"clear_phone_code\" ng-disabled=\"model.inProgress\"></md-input-container><div style=\"text-align:center\">Cannot install Authy application? <a href=\"\" ng-click=\"sendTextSms();\">Get code in SMS.</a></div><div style=\"text-align:center\"><a href=\"\" ui-sref=\"layout_app.settings.profile\">Cancel</a></div></form>");
$templateCache.put("modules/2fa/disable_g2fa.form.html","<form name=\"disableGoogle2faForm\" novalidate=\"novalidate\"><div style=\"text-align:center\">Enter verification code to disable two-factor authentication<br><br></div><md-input-container><label>Google Authenticator verification code</label> <input type=\"text\" name=\"disable_google2fa\" ng-model=\"model.disable_google2fa\" ng-minlength=\"1\" ng-maxlength=\"250\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" autofocus=\"autofocus\" focus-on=\"disable_google2fa\" ng-disabled=\"model.inProgress\"></md-input-container><div style=\"text-align:center\"><a href=\"\" ui-sref=\"layout_app.settings.profile\">Cancel</a></div></form>");
$templateCache.put("modules/activity/_acquire_description.html","You acquired <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_adjustment_deposit_description.html","Adjustment addition <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_adjustment_withdraw_description.html","Adjustment deduction <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_claimed_own_description.html","You claimed <span class=\"colour\">{{ absoluteAmount| money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_convert_description.html","You converted <span class=\"colour\">{{ absoluteAmount| money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_receive_description.html","You received <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_redeem_description.html","You redeemed <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_send_description.html","You sent <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span>");
$templateCache.put("modules/activity/_unclaimed_return_description.html","You have <span class=\"colour\">{{ absoluteAmount | money:transaction.currency }}</span> unclaimed");
$templateCache.put("modules/activity/activity.html","<div layout=\"columnn\" layout-align=\"center\" class=\"activity-page\"><div layout=\"column\" layout-align=\"start center\" flex=\"90\" flex-sm=\"95\" class=\"transaction-activity\"><div check-notices=\"activityNotices\" ng-if=\"$root.$storage.ledger !== undefined\"><h4 class=\"md-subhead\">Transaction Activity</h4><div class=\"table-responsive\"><table class=\"table transactions-table\"><tr class=\"header\"><th class=\"date text-center\">Date</th><th class=\"status text-center\">Status</th><th class=\"description\">Description</th><th class=\"info\"></th><th class=\"amount text-center\">Amount</th></tr><tr ng-repeat=\"transaction in ledger\" ng-class=\"$even ? \'odd\' : \'even\'\" class=\"body\"><td class=\"date text-center\"><span class=\"month\">{{ transaction.created_at | date:\'MMM\' }}</span><span class=\"day\">{{ transaction.created_at | date:\'d\' }}</span></td><td class=\"status\"><md-icon md-svg-icon=\"tx:{{transaction.tx_type}}\" alt=\"{{ transaction.status }}\" ng-class=\"transaction.status\"></md-icon><span>{{ transaction.status }}</span></td><td class=\"description\">{{ transaction.description }}<span ng-if=\"transaction.transaction_id != null\"><br>TXID:&nbsp;</span><a ng-if=\"transaction.transaction_id != null\" href=\"{{ transaction.url }}\" target=\"_blank\">{{ transaction.transaction_id | limitTo:7 }}[...]</a></td><td><a ng-click=\"showDetails(transaction)\" href=\"\" class=\"explanation\"><i class=\"fa fa-info-circle\"></i></a><a ng-click=\"showDetails(transaction)\" href=\"\" title=\"Click to see the attached message\" ng-if=\"transaction.message\" class=\"explanation\"><i class=\"fa fa-envelope-o\"></i></a></td><td ng-class=\"transaction.status\" class=\"amount\"><span class=\"value\">{{ transaction.amount | money:transaction.currency:{ showPlus: true, isShort: true } }}</span> <span class=\"currency\">{{ transaction.currency }}</span></td></tr><tr ng-repeat-end=\"ng-repeat-end\" ng-if=\"transaction.could_be_exchanged\" ng-class=\"$even ? \'odd\' : \'even\'\" class=\"exchange\"><td colspan=\"5\" class=\"text-center\">Do you want to exchange {{ $root.Wallet.getBalanceByIso(\'bitcoin\').code }} to {{ $root.Wallet.getBalanceByIso(\'usdt\').code }}?<span><md-button type=\"button\" ng-click=\"convertIncomingBtc(transaction.id, 1)\">Yes</md-button><md-button type=\"button\" ng-click=\"convertIncomingBtc(transaction.id, 0)\">No</md-button></span></td></tr></table></div></div></div></div>");
$templateCache.put("modules/activity/activity_details.modal.html","<md-dialog class=\"activity-details-modal\"><form name=\"detailsForm\" novalidate=\"novalidate\" class=\"disable-scroll\"><md-dialog-content class=\"sticky-container\"><md-subheader ng-class=\"transaction.status\" class=\"md-sticky-no-effect md-headline text-center\"><div ng-include=\"descriptionUrl\"></div></md-subheader><div><div class=\"md-display-container\"><label>Status</label><div class=\"value\">{{ transaction.status }}</div></div><div ng-switch=\"transaction.tx_type\" class=\"md-display-container\"><label ng-switch-when=\"send\">Sent</label> <label ng-switch-when=\"unclaimed_return\">Sent</label> <label ng-switch-when=\"claimed_own\">Sent</label> <label ng-switch-when=\"receive\">Received</label> <label ng-switch-default=\"ng-switch-default\">Date</label><div class=\"value\">{{ transaction.created_at | date:\"MMM d, y \'at\' h:mm a\"}}</div></div><div class=\"md-display-container\"><label>Amount</label><div class=\"value\">{{ transaction.amount | money:transaction.currency }}</div></div><div ng-if=\"transaction.fee\" class=\"md-display-container\"><label>Fee</label><div class=\"value\">{{ transaction.fee | money:transaction.currency }}</div></div><div ng-if=\"transaction.counterparty_address\" ng-switch=\"transaction.tx_type\" class=\"md-display-container\"><label ng-switch-when=\"send\">Recipient</label> <label ng-switch-when=\"unclaimed_return\">Recipient</label> <label ng-switch-when=\"claimed_own\">Recipient</label> <label ng-switch-when=\"receive\">Sender</label> <label ng-switch-default=\"ng-switch-default\">Counterparty</label><div class=\"value\">{{ transaction.counterparty_address }}</div></div><div ng-if=\"transaction.transaction_id\" class=\"md-display-container\"><label>Transaction ID</label><div class=\"value\"><a href=\"{{ transaction.url }}\" target=\"_blank\">{{ transaction.transaction_id }}</a></div></div><div ng-if=\"transaction.reference_id\" class=\"md-display-container\"><label>Reference ID</label><div class=\"value\">{{ transaction.reference_id }}</div></div><div ng-if=\"transaction.message\" class=\"md-display-container\"><label>Memo</label><div class=\"value\">{{ transaction.message }}</div></div></div></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button ng-click=\"close()\" type=\"button\" class=\"md-primary\">Close</md-button></div></form></md-dialog>");
$templateCache.put("modules/convert/convert.html","<div layout=\"column\" class=\"page-header\"><div layout=\"row\" layout-align=\"center center\" hide-sm=\"\" class=\"md-caption md-primary\">Convert between bitcoin and supported tether currencies.</div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center start\" check-notices=\"sendNotices\" class=\"page-with-header\"><form flex=\"100\" name=\"convertForm\" ng-submit=\"confirm()\" novalidate=\"novalidate\" class=\"convert-page\"><div flex=\"80\" flex-sm=\"70\" layout=\"row\" layout-align=\"center start\" class=\"currency-select\"><md-input-container flex=\"75\" flex-sm=\"60\" class=\"left\"><label>FROM</label> <input ng-model=\"model.amount\" ng-change=\"changedAmount()\" name=\"amount\" required=\"required\" type=\"number\" positive-number=\"positive-number\" ng-min=\"model.minExchangeAmount\" ng-max=\"model.maxExchangeAmount\" ng-attr-step=\"{{ model.inputStep }}\" ng-pattern=\"model.inputPattern\" ng-disabled=\"model.disabledForm\" tabindex=\"0\"><div ng-messages=\"convertForm.amount.$error\" role=\"alert\" ng-if=\"convertForm.amount.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"number\">Amount is in not correct format</div><div ng-message=\"min\">Amount must be greater than {{ model.minExchangeAmount }} {{ model.selectedFromCurrency.code }}</div><div ng-message=\"pattern\">Amount is in not correct format</div><div ng-message=\"max\">You have insufficient funds</div></div></md-input-container><div layout=\"column\" flex=\"25\" flex-sm=\"40\"><md-select ng-model=\"model.selectedFromCurrency\" required=\"required\" ng-disabled=\"model.disabledForm\" class=\"right currency-dropdown\"><md-select-label><div><md-icon md-svg-icon=\"flags:{{ model.selectedFromCurrency.iso }}\" class=\"flag\"></md-icon>{{ model.selectedFromCurrency.code }}</div></md-select-label><md-option ng-value=\"fromCurrency\" ng-repeat=\"fromCurrency in model.fromAvailableCurrencies\"><md-icon md-svg-icon=\"flags:{{ fromCurrency.iso }}\" class=\"flag\"></md-icon>{{ fromCurrency.code }}</md-option></md-select></div></div><div flex=\"80\" flex-sm=\"70\" layout=\"row\" layout-align=\"center start\" class=\"currency-select result-amount\"><label hide-sm=\"hide-sm\" class=\"hint\"><i class=\"fa fa-exclamation-circle\"></i><md-tooltip md-direction=\"right\">The current live exchange rate may differ once the conversion is complete</md-tooltip></label><md-input-container flex=\"75\" flex-sm=\"60\" class=\"left\"><label>TO</label> <input ng-model=\"model.convertedAmount\" name=\"convertedAmount\" readonly=\"readonly\" currencyformat=\"currencyformat\" cr-precision=\"model.selectedToCurrency.precision\" tabindex=\"1\"></md-input-container><div layout=\"column\" flex=\"25\" flex-sm=\"40\"><md-select ng-model=\"model.selectedToCurrency\" required=\"required\" ng-disabled=\"model.disabledForm\" class=\"right currency-dropdown\"><md-select-label><div><md-icon md-svg-icon=\"flags:{{ model.selectedToCurrency.iso }}\" class=\"flag\"></md-icon>{{model.selectedToCurrency.code}}</div></md-select-label><md-option ng-value=\"toCurrency\" ng-repeat=\"toCurrency in model.toAvailableCurrencies\"><md-icon md-svg-icon=\"flags:{{toCurrency.iso}}\" class=\"flag\"></md-icon>{{ toCurrency.code }}</md-option></md-select></div></div><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"(convertForm.$dirty &amp;&amp; convertForm.$invalid) || model.inProgress || model.disabledForm\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Sending...\' : \'Confirm\' }}</md-button></div></form></div>");
$templateCache.put("modules/convert/convert_review.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\">Review Transaction</div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center start\" class=\"page-with-header\"><form ng-submit=\"convert()\" layout=\"row\" flex=\"100\" layout-align=\"center start\" class=\"convert-page review-page\"><md-content flex=\"100\"><md-list-item layout=\"row\"><label flex=\"30\" class=\"currency_label\">From:</label><div class=\"amount\">{{ model.amount | currency_format:model.selectedFromCurrency.symbol:model.selectedFromCurrency.code:model.selectedFromCurrency.precision }}</div></md-list-item><md-list-item layout=\"row\"><label hide-sm=\"hide-sm\" class=\"hint\"><i class=\"fa fa-exclamation-circle\"></i><md-tooltip md-direction=\"right\">The current live exchange rate may differ once the conversion is complete</md-tooltip></label> <label flex=\"30\" class=\"currency_label\">To:</label><div class=\"amount\">{{ model.convertedAmount | currency_format:model.selectedToCurrency.symbol:model.selectedToCurrency.code:model.selectedToCurrency.precision }}</div></md-list-item><div layout=\"column\" layout-align=\"center\" class=\"submit\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Convert</md-button><md-button type=\"button\" ng-click=\"goBack()\">Go Back</md-button></div></md-content></form></div>");
$templateCache.put("modules/deposit/deposit.html","<div class=\"deposit-page\"><div layout=\"column\" class=\"page-header\"><div layout=\"row\" layout-align=\"center center\" class=\"nav-toggle\"><md-button class=\"md-toggle md-toggle-active\">Receive from Others</md-button><md-button ng-click=\"depositWire()\" class=\"md-toggle\">Fund from Bank</md-button></div><div layout=\"row\" layout-align=\"center center\" hide-sm=\"\" class=\"md-caption md-primary\">Request funds via your tether-enabled address</div><div class=\"stair\"></div></div><div layout=\"column\" check-notices=\"depositNotices\" class=\"page-with-header text-center\"><div style=\"margin-bottom: 20px;\" class=\"alert alert-lg alert-warning\">Please do not attempt to deposit anything as your funds may be lost.</div><h4 flex=\"100\" class=\"md-subhead text-center\">All User wallets are operating in withdraw mode. Deposit Addresses are unavailable at this time. For additional information please see <a href=\"https://tether.to/category/announcements/\" target=\"_blank\">our latest announcements</a>.</h4></div></div>");
$templateCache.put("modules/deposit_wire/deposit_wire.html","<div class=\"deposit-wire-page\"><div layout=\"column\" class=\"page-header\"><div layout=\"row\" layout-align=\"center center\" class=\"nav-toggle\"><md-button ng-click=\"depositQR()\" class=\"md-toggle\">Receive from Others</md-button><md-button class=\"md-toggle md-toggle-active\">Fund from Bank</md-button></div><div layout=\"row\" layout-align=\"center center\" hide-sm=\"\" class=\"md-caption md-primary\">Add value to your wallet by wiring funds from your bank account</div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center start\" check-notices=\"acquireNotices\" class=\"deposit-wire-page page-with-header\"><form flex=\"100\" name=\"depositWireForm\" ng-submit=\"continue()\" novalidate=\"novalidate\"><div layout=\"row\"><md-input-container flex=\"75\" flex-sm=\"60\" class=\"amount-input\"><label>Amount to acquire</label> <input name=\"amount\" ng-model=\"model.amount\" type=\"number\" ng-change=\"calculateFee()\" positive-number=\"positive-number\" required=\"required\" min=\"{{ minimalAmount }}\" step=\"0.01\" ng-model-options=\"{allowInvalid: true}\" ng-pattern=\"/^[0-9]+(.[0-9]{1,2})?$/\"><div ng-messages=\"depositWireForm.amount.$error\" ng-if=\"depositWireForm.amount.$touched\"><div ng-message=\"required\">Please specify amount you want to acquire</div><div ng-message=\"number\">Please enter a valid number</div><div ng-message=\"min\">You need to acquire a minimum of {{ minimalAmount }}</div><div ng-message=\"pattern\">Amount is in not correct format</div></div></md-input-container><currency-dropdown ng-model=\"currencyIso\" get-filter=\"acquireCurrencies()\" flex=\"25\" flex-sm=\"40\"></currency-dropdown></div><md-list-item layout=\"row\"><label hide-sm=\"hide-sm\" class=\"hint fee-exclamation\"><a class=\"explanation\"><i class=\"fa fa-exclamation-circle\"></i><md-tooltip md-direction=\"top\">{{getFeeMessage()}}</md-tooltip></a></label> <label flex=\"40\">Fee:</label><div ng-if=\"model.amount\" class=\"fee\">{{ model.fee | money:$root.Wallet.selectedBalance:{isShort:true} }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"40\">Total Amount to Wire:</label><div ng-if=\"model.amount\" class=\"total\">{{ model.totalAmount | money:$root.Wallet.selectedBalance:{isShort:true} }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"40\">Wire from account:</label><div layout=\"column\" ng-if=\"account_type === \'individual\'\">{{ user_bk_info.bank_statement_account_name }}<div>{{ user_bk_info.bank_statement_account_number }} {{ user_bk_info.bank_statement_name }}</div></div><div layout=\"column\" ng-if=\"account_type === \'corporate\'\">{{ user_bk_info.bank_account_name }}<div>{{ user_bk_info.bank_account_number }} {{ user_bk_info.bank_name }}</div></div></md-list-item><div layout=\"column\" layout-align=\"center\" style=\"margin-top: 16px;\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Continue</md-button></div></form></div></div>");
$templateCache.put("modules/deposit_wire/deposit_wire_info.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"review\"></md-icon>Review Wire Information</div><div class=\"stair\"></div></div><form name=\"depositWireInfoForm\" ng-submit=\"acquire()\" layout=\"row\" layout-align=\"center start\" class=\"deposit-wire-info-page page-with-header\"><md-content flex=\"100\" class=\"disable-scroll\"><p>Send the wire using the details provided below, including your transaction ID.</p><p>Your wallet will be credited with <span class=\"amount\">{{::model.amount | money:$root.Wallet.selectedBalance}}</span> when we receive your wire and approve it.</p><h4 class=\"md-title\">Wire transfer information (this will be emailed to you):</h4><div class=\"alert alert-info\"><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary:</label><div>TETHER LIMITED</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary address:</label><div>1308 Bank of America Tower, 12 Harcourt Road, Hong Kong</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary account:</label><div>018580071208</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary bank:</label><div>KGI BANK</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary bank address:</label><div>3F, NO. 125., SEC. 5, NANGING EAST RD., SONGSHAN DISTRICT, TAIPEI CITY 10504, TAIWAN, R.O.C.</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Beneficiary bank SWIFT:</label><div>CDIBTWTP</div></md-list-item><md-list-item layout=\"row\"><label flex=\"100\">Transaction reference ID:</label><div>{{::model.token}}</div></md-list-item></div><p>Please ensure that all information is exactly correct and you have included the transaction reference. All incoming wires must come from the bank account that was registered during verification. All other funds will be returned at the customers expense. Incorrect or missing reference numbers will delay processing.</p><div style=\"padding-bottom: 10px;\" class=\"alert alert-info\"><md-list-item layout=\"row\"><label flex=\"100\">Accepted Bank Account</label><div layout=\"column\" ng-if=\"account_type === \'individual\'\">{{ user_bk_info.bank_statement_account_name }}<div>{{ user_bk_info.bank_statement_account_number }} {{ user_bk_info.bank_statement_name }}</div></div><div layout=\"column\" ng-if=\"account_type === \'corporate\'\">{{ user_bk_info.bank_account_name }}<div>{{ user_bk_info.bank_account_number }} {{ user_bk_info.bank_name }}</div></div></md-list-item></div><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'authy\'\"><label flex=\"30\">Verification:</label><two-factor-auth ng-model=\"model.verification\" form=\"depositWireInfoForm\"></two-factor-auth></md-list-item><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\'\"><label flex=\"30\">Verification:</label><google-two-factor-auth ng-model=\"model.verification\" form=\"depositWireInfoForm\"></google-two-factor-auth></md-list-item><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Request Wire Transfer</md-button></div></md-content></form>");
$templateCache.put("modules/deposit_wire/deposit_wire_receipt.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"success\"></md-icon>Success!</div><div class=\"stair\"></div></div><form layout=\"column\" layout-align=\"center center\" class=\"deposit-wire-receipt-page page-with-header\"><p>Thanks for requesting to fund value from your bank account.</p><p>The details to complete the wire have been emailed to you.</p><div layout=\"row\" class=\"actions-row\"><md-button type=\"button\" ng-click=\"restartWire()\" flex=\"50\" flex-sm=\"45\">Send Another</md-button><md-button type=\"button\" ng-click=\"seeActivity()\" flex=\"50\" flex-sm=\"45\">See Activity</md-button></div></form>");
$templateCache.put("modules/deposit_wire/deposit_wire_review.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"review\"></md-icon>Review Transaction</div><div class=\"stair\"></div></div><form name=\"depositWireReviewForm\" ng-submit=\"confirm()\" layout=\"row\" layout-align=\"center start\" class=\"deposit-wire-review-page page-with-header\"><md-content flex=\"100\"><md-list-item layout=\"row\"><label flex=\"30\">Amount:</label><div>{{ model.amount | money:$root.Wallet.selectedBalance }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Fee:</label><div>{{ model.fee | money:$root.Wallet.selectedBalance:{isShort:true} }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Total to wire:</label><div class=\"amount\">{{ model.totalAmount | money:$root.Wallet.selectedBalance:{isShort:true} }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Wire from:</label><div layout=\"column\" ng-if=\"account_type === \'individual\'\">{{ user_bk_info.bank_statement_account_name }}<div>{{ user_bk_info.bank_statement_account_number }} {{ user_bk_info.bank_statement_name }}</div></div><div layout=\"column\" ng-if=\"account_type === \'corporate\'\">{{ user_bk_info.bank_account_name }}<div>{{ user_bk_info.bank_account_number }} {{ user_bk_info.bank_name }}</div></div></md-list-item><md-list class=\"agreement\"><md-list-item><div class=\"md-title\">I understand:</div></md-list-item><md-list-item><md-input-container><md-checkbox name=\"will_send\" ng-model=\"model.confirm.willSend\" required=\"required\" class=\"md-primary\">I will send a wire for the total (amount of tethers plus transfer fee)</md-checkbox><div ng-messages=\"depositWireReviewForm.will_send.$error\" ng-if=\"depositWireReviewForm.$submitted\"><div ng-message=\"required\">Please acknowledge this field</div></div></md-input-container></md-list-item><md-list-item><md-input-container><md-checkbox name=\"transaction_ref\" ng-model=\"model.confirm.transactionRef\" required=\"required\" class=\"md-primary\">My transaction reference ID: {{ model.token }}</md-checkbox><div ng-messages=\"depositWireReviewForm.transaction_ref.$error\" ng-if=\"depositWireReviewForm.$submitted\"><div ng-message=\"required\">Please acknowledge this field</div></div></md-input-container></md-list-item></md-list><h4 flex=\"100\" class=\"md-subhead text-left\">Wire information will be provided in the next step</h4><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"!model.confirm.willSend || !model.confirm.transactionRef || model.inProgress\" class=\"md-raised md-primary\">Continue</md-button><md-button type=\"button\" ng-click=\"goBack()\" ng-disabled=\"model.inProgress\">Go Back</md-button></div></md-content></form>");
$templateCache.put("modules/guest/geo.html","<md-whiteframe layout=\"column\" class=\"md-whiteframe-z1\"><h1 class=\"md-headline\">Restricted Access</h1><p><strong>Sorry, you&#8217;ve logged in from a location that is restricted.</strong></p><p>Tether is committed to operating in a secure and transparent way, while adhering to all U.S. Government &#3;compliance and regulations.</p><p>For this reason Tether does not operate in &nbsp;<a ng-click=\"showBlockedCountriesPopup($event)\" href=\"\">countries and U.S. states&nbsp;</a>that do not regulate virtual currencies.</p><p>Please access Tether through our exchange partner&nbsp;<a href=\"https://www.bitfinex.com/\" target=\"_blank\">Bitfinex</a>, for now.</p><p><a ng-click=\"tryAgain()\" href=\"\">Try Again</a></p></md-whiteframe>");
$templateCache.put("modules/guest/geo.modal.html","<md-dialog><md-dialog-content><h3>Current countries with limited functionality:</h3><div>{{ geoBlocking.countries.sort().join(\', \') }}</div><h3>Current U.S. States with limited functionality:</h3><div>{{ geoBlocking.states.sort().join(\', \') }}</div><div class=\"md-actions\"><md-button ng-click=\"closeModal()\" type=\"button\" class=\"md-primary\">OK</md-button></div></md-dialog-content></md-dialog>");
$templateCache.put("modules/guest/invite.form.html","<form name=\"inviteForm\" ng-submit=\"inviteProcess()\" novalidate=\"novalidate\"><md-input-container md-is-error=\"inviteForm.email.$invalid &amp;&amp; !inviteForm.email.$pristine\"><label>Email address</label> <input type=\"email\" name=\"email\" ng-model=\"model.email\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" ng-minlength=\"4\" ng-maxlength=\"250\" autofocus=\"autofocus\" required=\"required\"></md-input-container><md-input-container><md-button type=\"submit\" ng-disabled=\"inviteForm.$invalid || model.inProgress\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Request Invite\' }}</md-button></md-input-container><div class=\"text-center\"><a ui-sref=\"layout_guest.signup\">Already have an invite code?</a></div></form>");
$templateCache.put("modules/guest/invite.html","<md-whiteframe layout=\"column\" class=\"request-invite-page md-whiteframe-z1\"><h1 class=\"md-headline\">Request beta access</h1><p>Welcome to Tether - digital cash for the digital age.</p><p>Create an account to access a more secure, fast, and low-cost way to transact with money.</p><div ng-include=\"\'modules/guest/invite.form.html\'\"></div></md-whiteframe>");
$templateCache.put("modules/guest/login.form.html","<form name=\"loginForm\" ng-submit=\"loginProcess()\" novalidate=\"novalidate\" layout=\"column\" class=\"login-form\"><md-input-container><label>Username or Email</label> <input type=\"text\" name=\"username\" ng-model=\"model.login\" autocapitalize=\"off\" autocorrect=\"off\" tabindex=\"1\" autofillsync=\"true\" ng-minlength=\"4\" ng-maxlength=\"250\" autofocus=\"autofocus\" required=\"required\" id=\"login\"><div ng-messages=\"loginForm.username.$error\" role=\"alert\" ng-if=\"loginForm.username.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"minlength\">This field is too short. Minimum length 4 symbols.</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><md-input-container class=\"password-row\"><label>Password</label> <input type=\"password\" name=\"password\" ng-model=\"model.password\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" tabindex=\"2\" autofillsync=\"true\" ng-minlength=\"6\" ng-maxlength=\"250\" required=\"required\" id=\"password\"><div ng-messages=\"loginForm.password.$error\" role=\"alert\" ng-if=\"loginForm.password.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"minlength\">This field is too short. Minimum length 6 symbols.</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><md-input-container class=\"forgot-password-row\"><div class=\"forgot-password-link\"><a href=\"#!/password\">Forgot your password?</a></div></md-input-container><two-factor-auth-login ng-model=\"model.verification\" ng-attr-credentials=\"credentials\" ng-if=\"two_factor_auth_enabled &amp;&amp; !twofa_type_google &amp;&amp; (twofa_type == \'authy\' || !twofa_type)\"></two-factor-auth-login><google-two-factor-auth ng-model=\"model.verification\" ng-attr-credentials=\"credentials\" ng-if=\"two_factor_auth_enabled &amp;&amp; twofa_type == \'google_auth\'\"></google-two-factor-auth><md-button ng-disabled=\"loginForm.$invalid || model.inProgress\" tabindex=\"3\" class=\"submit-btn md-raised md-primary\">{{ model.inProgress ? \'Authenticating...\' : \'Log in\' }}</md-button><div class=\"signup-link\">Don\'t have an account? <a href=\"#!/signup\">Sign up</a></div></form>");
$templateCache.put("modules/guest/login.html","<md-whiteframe layout=\"column\" class=\"login-page md-whiteframe-z1\"><h1 class=\"md-headline\">Log in to your account</h1><div ng-include=\"\'modules/guest/login.form.html\'\"></div></md-whiteframe>");
$templateCache.put("modules/guest/password.form.html","<form name=\"passwordForm\" ng-submit=\"passwordResetProcess()\" novalidate=\"novalidate\"><md-input-container md-is-error=\"passwordForm.email.$invalid &amp;&amp; !passwordForm.email.$pristine\" class=\"email-row\"><label>Email Address</label> <input type=\"text\" name=\"email\" ng-pattern=\"EMAIL_REGEXP\" ng-model=\"model.email\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" ng-minlength=\"4\" ng-maxlength=\"250\" autofocus=\"autofocus\" required=\"required\"><div ng-messages=\"passwordForm.email.$error\" role=\"alert\" ng-if=\"passwordForm.email.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"minlength\">This field is too short. Minimum length 4 symbols.</div><div ng-message=\"pattern\">Invalid email format</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><md-input-container><md-button type=\"submit\" ng-disabled=\"passwordForm.$invalid || model.inProgress\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Reset\' }}</md-button></md-input-container></form>");
$templateCache.put("modules/guest/password.html","<md-whiteframe layout=\"column\" class=\"md-whiteframe-z1 pssword-page\"><h1 class=\"md-headline\">Reset your password</h1><div ng-include=\"\'modules/guest/password.form.html\'\"></div></md-whiteframe>");
$templateCache.put("modules/guest/password_reset.form.html","<form name=\"passwordResetForm\" ng-submit=\"passwordResetProcess()\" novalidate=\"novalidate\"><md-input-container class=\"password-row\"><label>Password</label> <input type=\"password\" name=\"password\" ng-model=\"model.password\" ng-minlength=\"8\" ng-maxlength=\"250\" ng-model-options=\"{ allowInvalid: true }\" ng-pattern=\"PASSWORD_REGEXP\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" autofocus=\"autofocus\" tabindex=\"1\" required=\"required\"><div ng-messages=\"passwordResetForm.password.$error\" role=\"alert\" ng-if=\"passwordResetForm.password.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"minlength\">This field is too short. Minimum length 8 symbols.</div><div ng-message=\"pattern\">Password must contain a lower and upper case letters and number</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><password-strength model=\"model\"></password-strength><md-input-container class=\"password-confirm-row\"><label>Confirm Password</label> <input type=\"password\" ng-model=\"model.passwordConfirm\" name=\"passwordConfirm\" ng-minlength=\"8\" ng-maxlength=\"250\" tabindex=\"2\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\" match-field=\"match-field\" data-match=\"password\"><div ng-messages=\"passwordResetForm.passwordConfirm.$error\" role=\"alert\" ng-if=\"passwordResetForm.passwordConfirm.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"match-field\">Confirm Password should match Password field</div></div></md-input-container><md-input-container ng-if=\"params.phone\"><div two-factor-auth=\"two-factor-auth\" ng-model=\"model.twoFactorAuthCode\" phone=\"{{ params.phone }}\" token=\"{{ params.token }}\"></div></md-input-container><md-input-container ng-if=\"params.two_factor_auth_type == \'google_auth\'\"><div google-two-factor-auth=\"google-two-factor-auth\" ng-model=\"model.twoFactorAuthCode\"></div></md-input-container><md-input-container><md-button type=\"submit\" ng-disabled=\"passwordResetForm.$invalid || model.password !== model.passwordConfirm || model.inProgress\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Change password\' }}</md-button></md-input-container></form>");
$templateCache.put("modules/guest/password_reset.html","<md-whiteframe layout=\"column\" class=\"md-whiteframe-z1 password-reset-page\"><h1 class=\"md-headline\">Reset your password</h1><div style=\"margin-bottom: 8px\">Your Tether wallet and deposit address are linked to your current password. When you go through/complete the password reset process a few things happen:</div><div style=\"margin-bottom: 8px\">1) <b>Your account is put on a 5 day security hold/review</b> (gives you time to contact us in case your email was compromised and someone is trying to compromise your Tether account).</div><div style=\"margin-bottom: 8px\">2) A <b>new wallet/deposit address is created</b> using your new password.</div><div style=\"margin-bottom: 8px\">3) A <b>recovery request</b> to move any funds from your old wallet to your new wallet is created and sent to the admin team for processing. This is a manual process to complete. The admin team routinely reviews outstanding requests but it can sometimes <b>take up to 5 days to process</b> due to the security involved in signing the recovery transactions.</div><div ng-include=\"\'modules/guest/password_reset.form.html\'\"></div></md-whiteframe>");
$templateCache.put("modules/guest/signup.form.html","<style>\n  .selectize-input.selectize-focus {\n  border-color: rgba(20,123,88,0.87) !important;\n  border-bottom: 1px solid rgba(20,123,88,0.87) !important;\n  }\n  \n</style><form name=\"signupForm\" ng-submit=\"signupProcess()\" novalidate=\"novalidate\"><div><p>Welcome to Tether - digital cash for the digital age.<br>Tether provides you access to a more secure, fast, and low-cost way to transact with money.</p></div><div ng-if=\"model.claimToken\" class=\"claimNotice\"><p><strong>{{ model.claimTokenInfo.username }} sent you {{ model.claimTokenInfo.amount }} {{ model.claimTokenInfo.currency }}.</strong></p><p><strong>Create an account to claim your funds.</strong></p><p>Already have an account? <a ui-sref=\"layout_guest.login\">Log In</a></p></div><md-input-container><label>First Name</label> <input type=\"text\" name=\"firstname\" ng-model=\"model.firstname\" ng-minlength=\"1\" ng-maxlength=\"250\" ng-pattern=\"/^[a-z\\-\'\\.]+( [a-z\\-\'\\.]+)*$/i\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"><div ng-messages=\"signupForm.firstname.$error\" role=\"alert\" ng-if=\"signupForm.firstname.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"pattern\">Should only contain latin letters, space, dash, apostrophe and period</div></div></md-input-container><md-input-container><label>Last Name</label> <input type=\"text\" name=\"lastname\" ng-model=\"model.lastname\" ng-minlength=\"1\" ng-maxlength=\"250\" ng-pattern=\"/^[a-z\\-\'\\.]+( [a-z\\-\'\\.]+)*$/i\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"><div ng-messages=\"signupForm.lastname.$error\" role=\"alert\" ng-if=\"signupForm.lastname.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"pattern\">Should only contain latin letters, space, dash, apostrophe and period</div></div></md-input-container><md-input-container><label>Email Address</label> <input type=\"email\" name=\"email\" ng-model=\"model.email\" ng-minlength=\"6\" ng-maxlength=\"250\" ng-pattern=\"EMAIL_REGEXP\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\" unique=\"unique\"><div ng-messages=\"signupForm.email.$error\" role=\"alert\" ng-if=\"signupForm.email.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"pattern\">Must be valid email address</div><div ng-message=\"unique\">This email already exists</div><div ng-message=\"minlength\">This field is too short. Minimum length 6 symbols.</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><md-input-container><label>Username</label> <input type=\"text\" name=\"username\" ng-model=\"model.username\" ng-minlength=\"4\" ng-maxlength=\"250\" ng-pattern=\"/^[a-zA-Z0-9\\.\\-_@]+$/\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\" unique=\"unique\"><div ng-messages=\"signupForm.username.$error\" role=\"alert\" ng-if=\"signupForm.username.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"pattern\">Should only contain letters, numbers, or .-_@</div><div ng-message=\"unique\">This username already exists</div><div ng-message=\"minlength\">This field is too short. Minimum length 4 symbols.</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><md-input-container><label>Password</label> <input type=\"password\" name=\"password\" ng-model=\"model.password\" ng-minlength=\"8\" ng-maxlength=\"250\" ng-model-options=\"{ allowInvalid: true }\" ng-pattern=\"/^(?=.*[a-z])(?=.*[A-Z])((?=.*\\d)|(?=.*(_|[^\\w]))).+$/\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"><div ng-messages=\"signupForm.password.$error\" role=\"alert\" ng-if=\"signupForm.password.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"minlength\">This field is too short. Minimum length 8 symbols.</div><div ng-message=\"pattern\">Password must contain a lower and upper case letters and number</div><div ng-message=\"maxlength\">This field is too long. Maximum length 250 symbols.</div></div></md-input-container><password-strength model=\"model\"></password-strength><md-input-container><label>Confirm Password</label> <input type=\"password\" ng-model=\"model.passwordConfirm\" name=\"passwordConfirm\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\" match-field=\"match-field\" data-match=\"password\"><div ng-messages=\"signupForm.passwordConfirm.$error\" role=\"alert\" ng-if=\"signupForm.passwordConfirm.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"match-field\">Confirm Password should match Password field</div></div></md-input-container><div style=\"margin-bottom:30px; margin-top: 30px\" layout=\"row\"><div flex=\"85\" class=\"country-selector\"><ui-select ng-model=\"model.country\" reset-search-input=\"true\" required=\"required\"><ui-select-match placeholder=\"Country of Residence\">{{ $select.selected.name }}</ui-select-match><ui-select-choices repeat=\"country in model.countriesList | filter: $select.search\" ui-disable-choice=\"geoBlocking.enabled &amp;&amp; geoBlocking.countries.indexOf(country.name) &gt; -1\"><div ng-bind-html=\"country.name | highlight: $select.search\"></div></ui-select-choices></ui-select></div><div flex=\"15\" style=\"margin-top:-10px\"><md-button type=\"button\" ng-click=\"showBlockedCountriesPopup($event)\" title=\"Info\" aria-label=\"Info\" class=\"md-icon-button launch\"><i class=\"fa fa-info-circle\"></i></md-button></div></div><div ng-if=\"model.country &amp;&amp; model.statesList[model.country.code]\" style=\"margin-bottom:38px; margin-top: 55px\"><ui-select ng-model=\"model.selectedState\" reset-search-input=\"true\"><ui-select-match placeholder=\"State/Province\">{{ $select.selected.name }}</ui-select-match><ui-select-choices repeat=\"state in model.statesList[model.country.code] | filter: $select.search\" ui-disable-choice=\"geoBlocking.enabled &amp;&amp; stateBlocked(state)\"><div ng-bind-html=\"state.name | highlight: $select.search\"></div></ui-select-choices></ui-select></div><md-input-container ng-if=\"!model.country || !model.statesList[model.country.code]\"><label>State/Province</label> <input type=\"text\" ng-model=\"model.state\"></md-input-container><div><p>By creating an account you agree to our <a href=\"{{ model.CMS_URL }}/legal/\" target=\"_blank\">terms of service</a> and <a href=\"{{ model.CMS_URL }}/legal/\" target=\"_blank\">privacy policy</a></p></div><div vc-recaptcha=\"vc-recaptcha\" key=\"\'6LccYCkUAAAAAGikc0TFwEpFNyxOComcH4rCnxpy\'\" ng-model=\"model.myRecaptchaResponse\"></div><md-input-container style=\"margin-top: 15px\"><md-button type=\"submit\" ng-disabled=\"signupForm.$invalid || model.inProgress || model.passStrength &lt; 50 || model.password !== model.passwordConfirm || stateBlocked(model.state)\" class=\"md-raised md-primary\">{{ model.inProgress ? \'Working...\' : \'Create Account\' }}</md-button></md-input-container></form>");
$templateCache.put("modules/guest/signup.html","<md-whiteframe layout=\"column\" class=\"signup-page md-whiteframe-z1\"><h1 class=\"md-headline\">Create a Tether Account</h1><div ng-if=\"!$root.signup_disabled\" ng-include=\"\'modules/guest/signup.form.html\'\"></div><div ng-if=\"$root.signup_disabled\" class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Registrations are offline while we rebuild the system. For additional information please see <a href=\"https://tether.to/category/announcements/\" target=\"_blank\">our latest announcements</a>. To be notified when registrations are available again please send an email to <a href=\"mailto:signups+subscribe@tether.to?subject=Registrations%20Notification%20Signup\">signups+subscribe@tether.to</a>.</h4></div></md-whiteframe>");
$templateCache.put("modules/kyc/kyc.html","<script language=\"javascript\" type=\"text/javascript\">\n  $(function(){\n    $(\'iframe\').iframeAutoHeight();\n  });\n  window.scrollToTop = function() {\n    $(\'html, body\').animate({ scrollTop: 0 }, \'fast\');\n  };\n  \n  \n</script><div><iframe src=\"/verification\" width=\"100%\" frameborder=\"0\" scrolling=\"no\" seamless=\"seamless\"></iframe></div>");
$templateCache.put("modules/layout/_crypto_address.modal.html","<md-dialog class=\"crypto-address-modal\"><md-dialog-content class=\"sticky-container\"><div class=\"md-headline text-center\">Scan the QR for your address</div><div style=\"margin-bottom: 20px;\" class=\"alert alert-lg alert-warning\">This wallet address is only for USDâ‚®/EURâ‚® deposits. Any BTC sent to this address will not be reflected on your account.</div><div class=\"qrcode text-center\"><qrcode data=\"{{ address }}\" size=\"280\" version=\"4\" error-correction-level=\"M\"></qrcode></div><div class=\"text-center\"><input ng-model=\"address\" select-on-click=\"select-on-click\" class=\"crypto-address\"></div><a href=\"\" ng-click=\"close()\" class=\"close\"><i class=\"fa fa-times\"></i></a></md-dialog-content></md-dialog>");
$templateCache.put("modules/layout/_footer_app.html","<p class=\"copyright\">&copy; {{ layoutModel.currentDate | date: \'yyyy\' }} Tether. All rights reserved.</p><p class=\"links\"><a href=\"{{ layoutModel.TETHER_LINKS.privacy_policy }}\">Privacy</a><a href=\"{{ layoutModel.TETHER_LINKS.terms_of_service }}\">Terms of Service</a></p>");
$templateCache.put("modules/layout/_footer_guest.html","<p class=\"copyright-row\">&copy; {{ layoutModel.currentDate | date: \'yyyy\' }} Tether. All rights reserved.</p>");
$templateCache.put("modules/layout/_layout_app_sidebar.html","<md-list-item ng-repeat=\"currency in Wallet.balances\" ng-click=\"switchSelectedBalance(currency)\" ng-class=\"{\'active\': Wallet.selectedBalance.iso == currency.iso}\" ng-hide=\"currency.code === \'BTC\' &amp;&amp; currency.balance == 0\"><p>{{ currency.code }}</p><p class=\"text-right\">{{ currency.balance | money:currency:{isShort:true} }}</p><md-divider ng-if=\"$last &amp;&amp; $root.User.account.two_factor_auth_enabled &amp;&amp; $root.User.account.email_verified\"></md-divider></md-list-item>");
$templateCache.put("modules/layout/_mobile_navigation.html","<md-select ng-model=\"mobileNavigationSelected\" ng-init=\"mobileNavigationSelected = \'layout_app.settings.profile\'\" ng-change=\"$state.go(mobileNavigationSelected)\" aria-label=\"Menu\" class=\"dropdown-menu\"><md-select-label><i class=\"fa fa-ellipsis-v\"></i></md-select-label><md-option ng-value=\"\'layout_app.activity\'\">Activity</md-option></md-select>");
$templateCache.put("modules/layout/_sidenav_app.html","<div class=\"sidenav-right-content\"><div class=\"close\"><a href=\"\" ng-click=\"closeSideNavRight()\"><i class=\"fa fa-times\"></i></a></div><div class=\"user-logo\"><i class=\"fa fa-user\"></i><div class=\"username\">{{ $root.User.account.username }}</div></div><div class=\"nav-list\"><md-list-item ng-click=\"$state.go(\'layout_app.settings.profile\'); closeSideNavRight();\">Account Settings</md-list-item><md-list-item ng-click=\"$state.go(\'layout_app.settings.preferences\'); closeSideNavRight();\">Preferences</md-list-item><md-list-item ng-click=\"$state.go(\'layout_app.kyc\'); closeSideNavRight();\">Verification</md-list-item><md-list-item ng-click=\"$state.go(\'layout_app.settings.apikeys\'); closeSideNavRight();\">API Keys</md-list-item><md-list-item ng-click=\"goUrl(layoutModel.APP_URL + \'/transparency\'); closeSideNavRight();\">Transparency</md-list-item><md-list-item ng-click=\"$state.go(\'layout_app.logout\'); closeSideNavRight();\">Log out</md-list-item><div ng-if=\"$root.User.account.superadmin || $root.User.account.accountant || $root.User.account.compliant || $root.User.account.auditor || $root.User.account.merchant_admin\"><hr><md-list-item ng-if=\"$root.User.account.superadmin\" ng-click=\"goUrl(layoutModel.APP_URL + \'/power\'); closeSideNavRight();\">Powerboard</md-list-item><md-list-item ng-if=\"$root.User.account.accountant\" ng-click=\"goUrl(layoutModel.APP_URL + \'/power/storage\'); closeSideNavRight();\">Cold storage</md-list-item><md-list-item ng-if=\"$root.User.account.superadmin || $root.User.account.accountant || $root.User.account.auditor\" ng-click=\"goUrl(layoutModel.APP_URL + \'/userboard\'); closeSideNavRight();\">Userboard</md-list-item><md-list-item ng-if=\"$root.User.account.superadmin || $root.User.account.accountant || $root.User.account.auditor\" ng-click=\"goUrl(layoutModel.APP_URL + \'/compliance\'); closeSideNavRight();\">Complianceboard</md-list-item><md-list-item ng-if=\"$root.User.account.superadmin || $root.User.account.accountant\" ng-click=\"goUrl(layoutModel.APP_URL + \'/metrics\'); closeSideNavRight();\">Metrics</md-list-item><md-list-item ng-if=\"$root.User.account.superadmin || $root.User.account.merchant_admin\" ng-click=\"goUrl(layoutModel.APP_URL + \'/merchant\'); closeSideNavRight();\">Merchants</md-list-item></div></div></div>");
$templateCache.put("modules/layout/layout_app.html","<md-sidenav md-component-id=\"sidenav-right\" class=\"md-sidenav-right md-whiteframe-z2\"><div ng-include=\"\'modules/layout/_sidenav_app.html\'\" layout-padding=\"\"></div></md-sidenav><div class=\"layout-app\"><div hide-md=\"\" hide-sm=\"\" class=\"header\"><div class=\"container\"><nav class=\"logo-row\"><ul><li class=\"logo\"><a ui-sref=\"layout_app.send_funds\" ui-sref-opts=\"{reload: true}\"><img src=\"assets/images/logo_tether_180x53_white.png\" width=\"125\" alt=\"Tether Logo\"></a></li><li><a href=\"\" ng-click=\"toggleSideNavRight()\">{{ $root.User.account.username }} <i class=\"fa fa-user\"></i></a></li></ul></nav><hr><div class=\"navigation-row\"><div class=\"total-balance-block\"><div class=\"volume md-display-2\">{{ $root.Wallet.selectedBalance.balance | money:$root.Wallet.selectedBalance:{isShort:true} }}</div><div class=\"caption\">{{ $root.Wallet.selectedBalance.code }}</div></div><div class=\"navigation-top\"><a ui-sref=\"layout_app.send_funds\" ui-sref-opts=\"{reload: true}\" ng-class=\"{active: $state.includes(\'layout_app.send_funds\') || $state.includes(\'layout_app.withdraw\')}\"><md-icon md-svg-src=\"assets/images/icons/send_funds.svg\"></md-icon>Send Funds</a><a ui-sref=\"layout_app.deposit\" ui-sref-opts=\"{reload: true}\" ng-class=\"{active: $state.includes(\'layout_app.deposit\') || $state.includes(\'layout_app.deposit_wire\')}\"><md-icon md-svg-src=\"assets/images/icons/add_funds.svg\"></md-icon>Add Funds</a><a ui-sref=\"layout_app.activity\" ui-sref-active=\"active\" ui-sref-opts=\"{reload: true}\"><md-icon md-svg-src=\"assets/images/icons/activity.svg\"></md-icon>Activity</a></div></div></div></div><div hide-gt-md=\"\" class=\"header-mob\"><div class=\"container\"><div class=\"logo-row\"><div class=\"logo\"><a ui-sref=\"layout_app.send_funds\" ui-sref-opts=\"{reload: true}\"><img src=\"assets/images/logo_tether_180x53_white.png\" width=\"125\" alt=\"Tether Logo\"></a></div><div class=\"menu\"><a href=\"\" ng-click=\"toggleSideNavRight()\"><i class=\"fa fa-bars\"></i></a></div></div><div class=\"balance-row\"><div class=\"balance-block\"><ul rn-carousel=\"\" rn-carousel-controls=\"\" rn-carousel-index=\"$root.Wallet.selectedBalanceIndex\" rn-carousel-deep-watch=\"\" rn-carousel-buffered=\"\"><li ng-repeat=\"balance in $root.Wallet.balances track by $index\" ng-hide=\"balance.code === \'BTC\' &amp;&amp; balance.balance == 0\"><div class=\"volume md-display-2\">{{ balance.balance | currency:balance.symbol }}</div><div class=\"caption\">{{ balance.code }}</div></li></ul></div></div><div class=\"navigation-top\"><a ui-sref=\"layout_app.send_funds\" ui-sref-opts=\"{reload: true}\" ng-class=\"{active: $state.includes(\'layout_app.send_funds\') || $state.includes(\'layout_app.withdraw\')}\"><md-icon md-svg-src=\"assets/images/icons/send_funds.svg\"></md-icon>Send Funds</a><a ui-sref=\"layout_app.deposit\" ui-sref-active=\"active\" ui-sref-opts=\"{reload: true}\"><md-icon md-svg-src=\"assets/images/icons/add_funds.svg\"></md-icon>Add Funds</a><div ui-view=\"mobileNavigation\" class=\"dropdown-menu\"></div></div></div></div><div class=\"main\"><div class=\"container\"><section><div style=\"margin-top: 20px; text-align: center;\" class=\"alert alert-lg alert-danger\"><strong>Wallet Services are partially restored.<br>We are enabling withdrawals to allow users to remove funds from their wallets while a new system is being built.<br>Please DO NOT TRY TO SEND ANYTHING TO YOUR WALLET!</strong>.<br>For more information please <a href=\"https://tether.to/category/announcements/\" style=\"color:orange\" target=\"_blank\">see our latest announcements</a></div></section><section class=\"main-row\"><div hide-sm=\"\" hide-md=\"\" class=\"side-navigation\"><md-content ui-view=\"sidebar\"></md-content></div><div class=\"main-content\"><md-content><div ui-view=\"\"></div></md-content></div></section></div></div><div class=\"footer\"><div ng-include=\"\'modules/layout/_footer_app.html\'\" class=\"container\"></div></div></div>");
$templateCache.put("modules/layout/layout_guest.html","<div class=\"layout-guest\"><div class=\"logo-row\"><a href=\"{{ layoutModel.CMS_URL }}\" ng-if=\"$state.includes(\'layout_guest.login\')\"><img src=\"assets/images/logo_tether_180x53_white.png\" height=\"53\" width=\"180\" alt=\"Tether Logo\"></a><a ui-sref=\"layout_guest.login\" ng-if=\"!$state.includes(\'layout_guest.login\')\"><img src=\"assets/images/logo_tether_180x53_white.png\" height=\"53\" width=\"180\" alt=\"Tether Logo\"></a></div><div class=\"main-row\"><div ui-view=\"\"></div></div><div class=\"footer-row\"><footer ng-include=\"\'modules/layout/_footer_guest.html\'\"></footer></div></div>");
$templateCache.put("modules/send_funds/send_funds.html","<div layout=\"column\" class=\"page-header\"><div layout=\"row\" layout-align=\"center center\" class=\"nav-toggle\"><md-button class=\"md-toggle md-toggle-active\">Send</md-button><md-button ng-click=\"withdraw()\" class=\"md-toggle\">Withdraw</md-button></div><div layout=\"row\" layout-align=\"center center\" hide-sm=\"\" class=\"md-caption md-primary\"><span>Send tethers</span><span ng-show=\"user_has_btc\" style=\"padding-left: 4px;\">or bitcoins</span><span style=\"padding-left: 4px;\">instantly</span></div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center start\" check-notices=\"sendNotices\" class=\"send-funds-page page-with-header\"><form name=\"sendForm\" flex=\"100\" ng-submit=\"confirm()\"><md-content flex=\"100\"><div layout=\"column\" layout-align=\"center center\" ng-if=\"model.showWarning\" class=\"alert alert-lg alert-address\"><p class=\"text-center\"><i class=\"fa fa-exclamation-circle\"></i> Please confirm the address is tether-enabled to guarantee the delivery of tethers.<a href=\"https://tether.to/why-use-tether/\" target=\"_blank\">&nbsp;View partners</a></p></div><md-input-container><a ng-click=\"showExplanations($event)\" href=\"\" class=\"explanation\"><i class=\"fa fa-info-circle\"></i></a> <label>Recipient email or {{ $root.Wallet.selectedBalance.code }} wallet deposit address</label> <input name=\"recipient\" type=\"text\" ng-model=\"model.recipient\" ng-change=\"checkWarning()\" valid-recipient=\"valid-recipient\" required=\"required\"><div ng-messages=\"sendForm.recipient.$error\" role=\"alert\" ng-if=\"sendForm.recipient.$touched\"><div ng-message=\"required\">This field is required</div><div ng-message=\"valid-recipient\">Invalid email, URL, or {{ $root.Wallet.selectedBalance.code }} address</div><div ng-message=\"sending-to-self\">You cannot send to yourself</div></div></md-input-container><div layout=\"row\"><md-input-container flex=\"70\" flex-sm=\"60\" class=\"amount-input\"><label>Amount</label> <input name=\"amount\" ng-model=\"model.amount\" type=\"number\" min=\"{{ minAmount }}\" positive-number=\"positive-number\" max=\"{{ $root.Wallet.selectedBalance.balance }}\" required=\"required\" step=\"any\" ng-pattern=\"model.inputPattern\"><div ng-messages=\"sendForm.amount.$error\" role=\"alert\" ng-if=\"sendForm.amount.$touched\"><div ng-message=\"required\">Please specify the amount you want to send</div><div ng-message=\"number\">Please enter a valid number</div><div ng-message=\"min\">Please enter at least {{ minAmount }}</div><div ng-message=\"max\">You have insufficient funds</div><div ng-message=\"pattern\">Amount is in not correct format</div></div></md-input-container><currency-dropdown ng-model=\"currencyIso\" get-filter=\"currenciesFilter()\" flex=\"30\" flex-sm=\"40\"></currency-dropdown></div><md-input-container><label>Memo</label> <textarea ng-model=\"model.memo\" maxlength=\"150\" md-maxlength=\"150\"></textarea></md-input-container><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"!sendForm.$valid || model.inProgress\" class=\"md-raised md-primary\">Confirm</md-button></div></md-content></form></div>");
$templateCache.put("modules/send_funds/send_funds_explanation.modal.html","<md-dialog class=\"explanations-modal\"><md-content><h5 class=\"md-headline text-center\">You can send tethers to anyone who has an email address or tether-enabled bitcoin&nbsp;address.</h5><div class=\"md-title\">Bitcoin address</div><p>Tethers can only be sent to a tether-enabled bitcoin address. All blockchain transactions are irreversible, so please make sure the recipientâ€™s bitcoin address is both correct and tether-enabled before sending. If you are unsure whether the address is tether-enabled please send tethers via email.&nbsp;<a href=\"https://tether.to/why-use-tether/\" target=\"_blank\">View our integrated partners page</a> for the latest list of tether-enabled wallets.</p><div class=\"md-title\">Email address</div><p>You can send tethers via an email address. The email message will include a link for the recipient to log in to their Tether.to account, or create an account, in order to claim the tethers you sent them.</p><div layout=\"column\" layout-align=\"center center\" class=\"md-actions\"><md-button flex=\"30\" ng-click=\"close()\">Close</md-button></div></md-content></md-dialog>");
$templateCache.put("modules/send_funds/send_funds_receipt.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"success\"></md-icon>Success!</div><div class=\"stair\"></div></div><form layout=\"column\" layout-align=\"center center\" class=\"send-funds-receipt-page page-with-header\"><div class=\"md-title\">You Sent</div><div class=\"address\">{{ model.recipient }}</div><div class=\"amount md-display-2\">{{ model.amount | money:$root.Wallet.getBalanceByIso(currencyIso) }}</div><md-divider></md-divider><p>{{ model.today | date : \'longDate\' }}</p><div layout=\"row\" class=\"actions-row\"><md-button type=\"button\" ng-click=\"restartSend()\" flex=\"50\" flex-sm=\"45\">Send Another</md-button><md-button type=\"button\" ng-click=\"seeActivity()\" flex=\"50\" flex-sm=\"45\">See Activity</md-button></div></form>");
$templateCache.put("modules/send_funds/send_funds_review.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"review\"></md-icon>Review Transaction</div><div class=\"stair\"></div></div><form name=\"reviewSendForm\" ng-submit=\"sendFunds()\" layout=\"row\" layout-align=\"center start\" class=\"send-funds-review-page page-with-header\"><md-content flex=\"100\" class=\"disable-scroll\"><div layout=\"column\" layout-align=\"center center\" ng-if=\"model.showWarning\" class=\"alert alert-lg alert-address\"><p class=\"text-center\"><i class=\"fa fa-exclamation-circle\"></i> Please confirm the address is tether-enabled to guarantee the delivery of tethers.<a href=\"https://tether.to/why-use-tether/\" target=\"_blank\">&nbsp;View partners</a></p></div><md-list-item layout=\"row\"><label flex=\"30\">To:</label><div class=\"address\">{{ model.recipient }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Amount:</label><div class=\"amount\">{{ model.amount | money:$root.Wallet.getBalanceByIso(currencyIso) }}</div></md-list-item><md-list-item layout=\"row\" ng-if=\"model.memo\"><label flex=\"30\">Memo:</label><md-content>{{ model.memo }}</md-content></md-list-item><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'authy\'\"><label flex=\"30\">Verification:</label><two-factor-auth ng-model=\"model.verification\" form=\"reviewSendForm\"></two-factor-auth></md-list-item><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\'\"><label flex=\"30\">Verification:</label><google-two-factor-auth ng-model=\"model.verification\" form=\"reviewSendForm\"></google-two-factor-auth></md-list-item><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Send Funds</md-button><md-button type=\"button\" ng-click=\"goBack()\" ng-disabled=\"model.inProgress\">Go Back</md-button></div></md-content></form>");
$templateCache.put("modules/settings/_settings_sidebar.html","<md-list-item ng-click=\"$state.go(\'layout_app.settings.profile\')\" ng-class=\"{\'active\': $state.includes(\'layout_app.settings.profile\')}\">Profile</md-list-item><md-list-item ui-sref-active=\"active\" ng-click=\"$state.go(\'layout_app.settings.preferences\')\" ng-class=\"{\'active\': $state.includes(\'layout_app.settings.preferences\')}\">Preferences</md-list-item><md-list-item ui-sref-active=\"active\" ng-click=\"$state.go(\'layout_app.settings.apikeys\')\" ng-class=\"{\'active\': $state.includes(\'layout_app.settings.apikeys\')}\">API Keys</md-list-item>");
$templateCache.put("modules/settings/api_key_activated.modal.html","<md-dialog class=\"api-key-activation-modal\"><form name=\"activationForm\" ng-submit=\"cancel()\" novalidate=\"novalidate\"><md-dialog-content class=\"sticky-container\"><md-subheader class=\"md-sticky-no-effect\">API key has been successfully activated.</md-subheader></md-dialog-content><md-dialog-content><p>Please copy the key/secret pair and store it in a safe place. API keys potentially give full access to the funds in your account.</p><p>You can read about key permissions on <a href=\"http://platform.tether.to/#permissions\" target=\"_blank\">API documentation</a> page.</p><md-input-container><label>Key</label> <input ng-model=\"keyId\" disabled=\"disabled\"></md-input-container><md-input-container><label>Secret</label> <textarea ng-model=\"keyCode\" columns=\"2\" disabled=\"disabled\"></textarea></md-input-container><img src=\"https://chart.googleapis.com/chart?chs=175x175&amp;chld=M%7C0&amp;cht=qr&amp;chl=key:{{keyId_encoded}}-secret:{{keyCode_encoded}}\"></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button ng-click=\"cancel()\" type=\"button\" class=\"md-primary\">OK</md-button></div></form></md-dialog>");
$templateCache.put("modules/settings/api_key_activation.modal.html","<md-dialog class=\"api-key-activation-modal\"><form name=\"activationForm\" ng-submit=\"activate()\" novalidate=\"novalidate\"><md-dialog-content class=\"sticky-container\"><md-subheader class=\"md-sticky-no-effect\">Activation of API key: {{ keyCode }}</md-subheader><div><div><p>For your protection, we require email verification to enable your API key. We have sent you an email with a verification code.</p><p>To activate your API key please insert the verification code below.</p></div><div class=\"flex-container\"><md-input-container class=\"code\"><input type=\"text\" ng-model=\"activationCode\" placeholder=\"Activation code from email\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\" name=\"confirmationCode\" ng-keyup=\"setConfirmationValid()\"><div ng-messages=\"activationForm.confirmationCode.$error\" role=\"alert\" ng-if=\"activationForm.confirmationCode.$touched\"><div ng-message=\"required\">Please enter your confirmation code</div><div ng-message=\"wrongCode\">Wrong code</div></div></md-input-container><md-input-container class=\"resend\"><a href=\"\" ng-click=\"resendCode(keyId)\" ng-if=\"!activationSendInProgress &amp;&amp; !activationSent\">Resend code</a><span ng-if=\"activationSendInProgress\">Sending...</span><span ng-if=\"activationSent\">Activation code was sent. Please check your email.</span></md-input-container><span ng-show=\"errorMessage\" class=\"help-block\"><div class=\"has-error\">{{ errorMessage }}</div></span><div two-factor-auth=\"two-factor-auth\" ng-show=\"$root.User.account.two_factor_auth_type == \'authy\'\" ng-model=\"twoFactorAuthCode\" set-code-valid=\"setTwoFactorAuthValid()\" class=\"two-fa\"></div><div google-two-factor-auth=\"google-two-factor-auth\" ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\'\" ng-model=\"twoFactorAuthCode\" class=\"two-fa\"></div></div></div></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button ng-click=\"cancel()\" type=\"button\" class=\"md-primary\">Cancel</md-button><md-button ng-disabled=\"activationForm.$invalid || inProgress\" class=\"md-primary\">Activate</md-button></div></form></md-dialog>");
$templateCache.put("modules/settings/api_key_deletion.modal.html","<md-dialog class=\"api-key-deletion-modal\"><form name=\"apiKeyDeletionForm\" ng-submit=\"delete()\" novalidate=\"novalidate\"><md-dialog-content class=\"sticky-container\"><md-subheader class=\"md-sticky-no-effect\">Deletion of API key</md-subheader><div><p>Please confirm the deletion of API key: <strong>{{ keyCode }}</strong></p><div ng-show=\"errorMessage\"><span>{{ errorMessage }}</span></div><div two-factor-auth=\"two-factor-auth\" ng-if=\"$root.User.account.two_factor_auth_type == \'authy\'\" ng-model=\"twoFactorAuthCode\" set-code-valid=\"setTwoFactorAuthValid()\" class=\"two-fa\"></div><div google-two-factor-auth=\"google-two-factor-auth\" ng-if=\"$root.User.account.two_factor_auth_type == \'google_auth\'\" ng-model=\"twoFactorAuthCode\" class=\"two-fa\"></div></div></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button ng-click=\"cancel()\" type=\"button\" class=\"md-primary\">Cancel</md-button><md-button ng-disabled=\"apiKeyDeletionForm.$invalid || inProgress\" class=\"md-primary\">Delete</md-button></div></form></md-dialog>");
$templateCache.put("modules/settings/api_key_permissions.modal.html","<md-dialog class=\"api-key-permissions-modal\"><form name=\"ApiKeyPermissionsForm\" ng-submit=\"save()\"><md-dialog-content class=\"sticky-container\"><md-subheader class=\"md-sticky-no-effect\">{{ !keyId ? \'New API key\' : \'Updating of API key: \' + keyCode }}</md-subheader><div>API potentially gives full access to your funds. You can read about key permissions on&nbsp;<a href=\"http://platform.tether.to/#permissions\" target=\"_blank\">API documentation</a> page</div><div><h4 class=\"md-subhead small\">Permissions</h4><md-list class=\"select-all\"><md-list-item><md-checkbox ng-model=\"selectAll\" id=\"select_all\" class=\"md-primary\"></md-checkbox><p>Select All</p></md-list-item></md-list><md-list class=\"permissions-list\"><md-list-item ng-repeat=\"permission in permissionsList\"><md-checkbox ng-model=\"selectedPermissions[permission]\" class=\"md-primary\"></md-checkbox><p>{{ permission }}</p></md-list-item></md-list><div ng-show=\"errorMessage\"><div class=\"has-error\">{{ errorMessage }}</div></div><div ng-if=\"keyId &amp;&amp; $root.User.account.two_factor_auth_type == \'authy\'\" two-factor-auth=\"two-factor-auth\" ng-model=\"twoFactorAuthCode\" set-code-valid=\"setTwoFactorAuthValid()\" class=\"two-fa\"></div><div google-two-factor-auth=\"google-two-factor-auth\" ng-if=\"keyId &amp;&amp; $root.User.account.two_factor_auth_type == \'google_auth\'\" ng-model=\"twoFactorAuthCode\" class=\"two-fa\"></div></div></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button type=\"button\" ng-click=\"cancel()\" class=\"md-primary\">Cancel</md-button><md-button ng-disabled=\"ApiKeyPermissionsForm.$invalid || inProgress\" class=\"md-primary\">Save</md-button></div></form></md-dialog>");
$templateCache.put("modules/settings/api_key_secret.modal.html","<md-dialog class=\"api-key-secret-modal\"><form name=\"secretKeysForm\" ng-submit=\"showSecrets()\" novalidate=\"novalidate\"><md-dialog-content class=\"sticky-container\"><md-subheader class=\"md-sticky-no-effect\">Show secret keys</md-subheader><div><div two-factor-auth=\"two-factor-auth\" ng-show=\"$root.User.account.two_factor_auth_type == \'authy\'\" ng-model=\"twoFactorAuthCode\"></div><div google-two-factor-auth=\"google-two-factor-auth\" ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\'\" ng-model=\"twoFactorAuthCode\"></div></div></md-dialog-content><div layout=\"row\" class=\"md-actions\"><md-button ng-click=\"cancel()\" type=\"button\" class=\"md-primary\">Cancel</md-button><md-button ng-disabled=\"secretKeysForm.$invalid || inProgress\" class=\"md-primary\">Show</md-button></div></form></md-dialog>");
$templateCache.put("modules/settings/api_keys.html","<div layout=\"column\" layout-align=\"left\" class=\"settings-api-page page-without-header\"><p ng-show=\"!isApiKeysAvailable()\" class=\"info-text\">To create an API key your account needs to be verified with two-factor authentication enabled.</p><div check-notices=\"noticesForApi\" class=\"main-container\"><div class=\"actions-row\"><md-button type=\"button\" ng-click=\"saveApiKey(null, $event)\">+ New API key</md-button><md-button type=\"button\" ng-click=\"showSecretKeys($event)\" ng-if=\"apiKeys.length &amp;&amp; !apiKeys[0].secret\"><i class=\"fa fa-unlock-alt\"></i> Show secret keys</md-button><md-button type=\"button\" ng-click=\"hideSecretKeys()\" ng-if=\"apiKeys.length &amp;&amp; apiKeys[0].secret\"><i class=\"fa fa-unlock-alt\"></i> Hide secret keys</md-button></div><div class=\"table-responsive\"><table class=\"table api-permissions-table\"><tr><th class=\"key\">key</th><th ng-if=\"apiKeys.length &amp;&amp; apiKeys[0].secret\" class=\"secret\">secret</th><th ng-if=\"apiKeys.length &amp;&amp; apiKeys[0].secret\" class=\"qrcode\">QR Code</th><th class=\"permissions\">permissions</th><th class=\"text-center\">status</th><th colspan=\"2\"></th></tr><tr ng-repeat=\"key in apiKeys\"><td class=\"key\">{{ key.key }}</td><td ng-if=\"key.secret\" class=\"secret\">{{ key.secret }}</td><td ng-if=\"key.secret\" class=\"qrcode\"><img src=\"https://chart.googleapis.com/chart?chs=175x175&amp;chld=M%7C0&amp;cht=qr&amp;chl=key:{{key.key_encoded}}-secret:{{key.secret_encoded}}\"></td><td class=\"permissions\"><span ng-if=\"isAllPermissionsSelected(key.permissions)\" class=\"permissions\">all</span><span ng-if=\"!isAllPermissionsSelected(key.permissions)\" ng-repeat=\"p in key.permissions\" class=\"permissions\">{{ p }}</span></td><td class=\"text-center\"><md-button type=\"button\" ng-click=\"activateApiKey(\'{{ key.id }}\', $event)\" ng-if=\"key.enabled == 0\" class=\"md-raised md-accent md-hue-2\">Activate</md-button><span ng-if=\"key.enabled &gt; 0\">Active</span></td><td class=\"actions\"><a href=\"\" ng-click=\"saveApiKey(\'{{ key.id }}\', $event)\" title=\"Update\"><i class=\"fa fa-pencil\"></i></a><a href=\"\" ng-click=\"deleteApiKey(key.id, $event)\" title=\"Delete\"><i class=\"fa fa-trash-o\"></i></a></td></tr></table></div></div></div>");
$templateCache.put("modules/settings/preferences.html","<div layout=\"column\" hide-sm=\"\" class=\"page-header\"><div class=\"md-headline\"></div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center\" class=\"settings-preferences-page page-with-header\"><form name=\"preferencesForm\" flex=\"100\" ng-submit=\"savePreferences()\"><div layout=\"row\" class=\"timezone-row\"><label flex=\"30\">Timezone</label><md-select flex=\"70\" ng-model=\"model.timezone\" placeholder=\"Select Preferred Timezone\"><md-option ng-repeat=\"timezone in timezonesList\" value=\"{{ timezone.code }}\" ng-bind=\"timezone.name\"></md-option></md-select></div><div layout=\"column\" layout-align=\"center\" class=\"actions-row\"><md-button class=\"md-raised md-primary\">Save Preferences</md-button></div></form></div>");
$templateCache.put("modules/settings/profile.html","<div layout=\"column\" hide-sm=\"\" class=\"page-header\"><div class=\"md-headline\"></div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center\" class=\"settings-profile-page page-with-header\"><form name=\"passwordForm\" flex=\"100\" ng-submit=\"savePassword()\"><md-input-container ng-if=\"$root.User.account.first_name\"><label>First Name</label> <input ng-model=\"$root.User.account.first_name\" disabled=\"disabled\"></md-input-container><md-input-container ng-if=\"$root.User.account.last_name\"><label>Last Name</label> <input ng-model=\"$root.User.account.last_name\" disabled=\"disabled\"></md-input-container><md-input-container><label>Email</label> <input ng-model=\"$root.User.account.email\" disabled=\"disabled\"></md-input-container><div ng-if=\"$root.User.account.two_factor_auth_type == \'authy\' || $root.User.account.two_factor_auth_type == \'google_auth\'\" style=\"border-bottom: 1px solid rgb(34,160,121); text-align: center; background: #fff; position: relative; height: 30px;margin-bottom: 10px;\"><span style=\"position: absolute; top: 15px; background: #fff; left: 170px; padding-left: 10px; padding-right: 10px; color: rgb(34,160,121); font-weight: bold;\">2FA is Active</span></div><div ng-if=\"$root.User.account.two_factor_auth_type == \'authy\'\" style=\"margin-bottom: 15px; margin-top: 8px;\">Authy Two-Factor Authentication is enabled on your account</div><div ng-if=\"$root.User.account.two_factor_auth_type == \'google_auth\'\" style=\"margin-bottom: 15px; margin-top: 8px;\">Google Two-Factor Authentication is enabled on your account</div><div ng-if=\"$root.User.account.two_factor_auth_type == \'authy\'\" layout=\"row\"><md-input-container flex=\"50\"><label>Phone</label> <input ng-model=\"displayPhoneNumber\" disabled=\"disabled\"></md-input-container><md-input-container flex=\"50\"><md-button type=\"button\" ng-click=\"disable2fa()\" class=\"md-primary\">Disable 2FA</md-button></md-input-container></div><div ng-if=\"$root.User.account.two_factor_auth_type == \'authy\'\" class=\"form-element-notice\">To change your phone number please disable 2FA and enable it again</div><div ng-if=\"$root.User.account.two_factor_auth_type == \'google_auth\'\" layout=\"row\"><md-input-container flex=\"flex\"><md-button type=\"button\" ng-click=\"disable2fa()\" class=\"md-primary\">Disable Google 2FA</md-button></md-input-container></div><div ng-if=\"!$root.User.account.two_factor_auth_enabled\" style=\"border-bottom: 1px solid #ddd; text-align: center; background: #fff; position: relative; height: 30px;margin-bottom: 10px;\"><span style=\"position: absolute; top: 15px; background: #fff; left: 170px; padding-left: 10px; padding-right: 10px; color: #999);\">2FA is Not Active</span></div><div ng-if=\"!$root.User.account.two_factor_auth_enabled\" layout=\"row\"><div class=\"md-caption\"><a ui-sref=\"layout_guest.2fa\">Enable Two-Factor authentication</a></div></div><div style=\"border-bottom: 1px solid #ddd; text-align: center; background: #fff; position: relative; height: 30px;margin-bottom: 10px; margin-top: 50px;\"><span style=\"position: absolute; top: 15px; background: #fff; left: 170px; padding-left: 10px; padding-right: 10px; color: #999;\">Change Password</span></div><div>Changing password will put your account on a 5 day security hold/review</div><div layout=\"row\"><md-input-container flex=\"50\"><label>New password</label> <input type=\"password\" name=\"password\" ng-model=\"model.password\" ng-minlength=\"8\" ng-maxlength=\"250\" ng-model-options=\"{ allowInvalid: true }\" ng-pattern=\"PASSWORD_REGEXP\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"></md-input-container><md-input-container flex=\"50\" ng-class=\"{\'md-input-invalid\': model.password !== model.passwordConfirm}\"><label>Confirm password</label> <input type=\"password\" name=\"password_confirmation\" ng-model=\"model.passwordConfirm\" ng-minlength=\"8\" ng-maxlength=\"250\" autocapitalize=\"off\" autocorrect=\"off\" autocomplete=\"off\" required=\"required\"></md-input-container></div><div ng-if=\"profileForm.password.$error.pattern || profileForm.password.$error.minlength\" class=\"custom-error\">Password must contain a lower and upper case letters and number</div><password-strength model=\"model\"></password-strength><div layout=\"column\" layout-align=\"center\" style=\"margin-top: 8px;\" class=\"actions-row\"><md-button ng-disabled=\"passwordForm.$invalid || model.password != model.passwordConfirm || model.inProgress\" flex=\"\" class=\"md-raised md-primary\">Change Password</md-button></div></form></div>");
$templateCache.put("modules/withdraw/withdraw.html","<div layout=\"column\" class=\"page-header\"><div layout=\"row\" layout-align=\"center center\" class=\"nav-toggle\"><md-button ng-click=\"send()\" class=\"md-toggle\">Send</md-button><md-button class=\"md-toggle md-toggle-active\">Withdraw</md-button></div><div layout=\"row\" layout-align=\"center center\" hide-sm=\"\" class=\"md-caption md-primary\">Enter the amount you wish to withdraw from your wallet and wire to your bank account</div><div class=\"stair\"></div></div><div layout=\"row\" layout-align=\"center start\" check-notices=\"redeemNotices\" class=\"withdraw-page page-with-header\"><form flex=\"100\" ng-submit=\"confirm()\" name=\"withdrawForm\"><div class=\"alert alert-lg alert-warning\"><p>We are currently experiencing longer than normal processing times for wire completion. Please see announcement <a href=\"https://tether.to/announcement/\" target=\"_blank\">here</a></p></div><div layout=\"row\"><md-input-container flex=\"70\" flex-sm=\"60\" class=\"amount-input\"><label>Amount to Wire</label> <input name=\"amount\" ng-model=\"model.amount\" ng-change=\"calculateFee()\" type=\"number\" positive-number=\"positive-number\" min=\"{{minimalAmount}}\" max=\"{{ $root.Wallet.selectedBalance.balance }}\" step=\"0.01\" ng-pattern=\"/^[0-9]+(.[0-9]{1,2})?$/\" required=\"required\"><div ng-messages=\"withdrawForm.amount.$error\" role=\"alert\" ng-if=\"withdrawForm.amount.$touched\"><div ng-message=\"required\">Please specify amount you want to send</div><div ng-message=\"number\">Please enter a valid number</div><div ng-message=\"min\">You need to widthdraw a minimum of {{ minimalAmount }}</div><div ng-message=\"max\">You have insufficient funds</div></div></md-input-container><currency-dropdown ng-model=\"currencyIso\" get-filter=\"withdrawCurrencies()\" flex=\"30\" flex-sm=\"40\"></currency-dropdown></div><md-input-container><md-checkbox ng-model=\"model.isExpress\" ng-change=\"calculateFee()\" ng-hide=\"$root.express_wire_disabled\" class=\"md-primary\">Express wire within 24 hours ({{ express_wire_percent }}% fee, with a minimum of {{ express_wire_price | money:Wallet.selectedBalance }})</md-checkbox></md-input-container><md-list-item layout=\"row\"><label hide-sm=\"hide-sm\" class=\"hint fee-exclamation\"><a class=\"explanation\"><i class=\"fa fa-exclamation-circle\"></i><md-tooltip md-direction=\"top\">{{getFeeMessage()}}</md-tooltip></a></label> <label flex=\"40\">Fee:</label><div class=\"fee\">{{ model.fee | money:Wallet.selectedBalance }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"40\">Total Amount to Withdraw:</label><div class=\"total\">{{model.totalAmount | money:Wallet.selectedBalance }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"40\">Beneficiary:</label><div layout=\"column\" ng-if=\"account_type === \'individual\'\">{{ user_bk_info.bank_statement_account_name }}<div>{{ user_bk_info.bank_statement_account_number }} {{ user_bk_info.bank_statement_name }}</div></div><div layout=\"column\" ng-if=\"account_type === \'corporate\'\">{{ user_bk_info.bank_account_name }}<div>{{ user_bk_info.bank_account_number }} {{ user_bk_info.bank_name }}</div></div></md-list-item><div layout=\"column\" layout-align=\"center\" style=\"margin-top: 16px;\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Confirm</md-button></div></form></div>");
$templateCache.put("modules/withdraw/withdraw_receipt.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"success\"></md-icon>Success!</div><div class=\"stair\"></div></div><form layout=\"column\" layout-align=\"center center\" class=\"withdraw-receipt-page page-with-header\"><p class=\"text-center\">Thanks for requesting to withdraw funds to your bank account. The transaction will take 2 - 3 days to complete.</p><div layout=\"row\" class=\"actions-row\"><md-button type=\"button\" ng-click=\"restartWithdraw()\" flex=\"50\" flex-sm=\"45\">Send Another</md-button><md-button type=\"button\" ng-click=\"seeActivity()\" flex=\"50\" flex-sm=\"45\">See Activity</md-button></div></form>");
$templateCache.put("modules/withdraw/withdraw_review.html","<div layout=\"column\" class=\"page-header\"><div class=\"md-headline\"><md-icon md-svg-icon=\"review\"></md-icon>Review Transaction</div><div class=\"stair\"></div></div><form name=\"reviewWithdrawForm\" ng-submit=\"withdraw()\" layout=\"row\" layout-align=\"center start\" class=\"withdraw-review-page page-with-header\"><md-content flex=\"100\" class=\"disable-scroll\"><md-list-item layout=\"row\"><label flex=\"30\">Beneficiary:</label><div layout=\"column\" ng-if=\"account_type === \'individual\'\">{{ user_bk_info.bank_statement_account_name }}<div>{{ user_bk_info.bank_statement_account_number }} {{ user_bk_info.bank_statement_name }}</div></div><div layout=\"column\" ng-if=\"account_type === \'corporate\'\">{{ user_bk_info.bank_account_name }}<div>{{ user_bk_info.bank_account_number }} {{ user_bk_info.bank_name }}</div></div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Amount:</label><div>{{ model.amount | money:$root.Wallet.selectedBalance }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Fee:</label><div>{{ model.fee | money:$root.Wallet.selectedBalance }}</div></md-list-item><md-list-item layout=\"row\"><label flex=\"30\">Total to wire:</label><div class=\"amount\">{{ model.totalAmount | currency:$root.Wallet.selectedBalance.symbol }}</div></md-list-item><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'authy\'\"><label flex=\"30\">Verification:</label><two-factor-auth ng-model=\"model.verification\" form=\"reviewWithdrawForm\"></two-factor-auth></md-list-item><md-list-item layout=\"row\" ng-show=\"$root.User.account.two_factor_auth_type == \'google_auth\'\"><label flex=\"30\">Verification:</label><google-two-factor-auth ng-model=\"model.verification\" form=\"reviewWithdrawForm\"></google-two-factor-auth></md-list-item><div layout=\"column\" layout-align=\"center\"><md-button ng-disabled=\"model.inProgress\" class=\"md-raised md-primary\">Withdraw Funds</md-button><md-button type=\"button\" ng-click=\"goBack()\">Go Back</md-button></div></md-content></form>");
$templateCache.put("components/currency_dropdown/currency_dropdown.html","<div layout=\"column\" class=\"currency-dropdown\"><md-select ng-model=\"ngModel\" ng-change=\"updateCode()\" placeholder=\"Currency\" flex=\"100\" class=\"currency-select\"><md-select-label><div><md-icon md-svg-icon=\"flags:{{ ngModel }}\" class=\"flag\"></md-icon>{{ currencyCode }}</div></md-select-label><md-option ng-repeat=\"currency in $root.Wallet.balances | filter:balancesFilter\" ng-value=\"currency.iso\"><md-icon md-svg-icon=\"flags:{{ currency.iso }}\" class=\"flag\"></md-icon>{{ currency.code }}</md-option></md-select></div>");
$templateCache.put("components/google_two_factor_auth/google_two_factor_auth.html","<ng-form name=\"twoFactorAuthForm\" class=\"two-factor-auth\"><md-input-container class=\"code\"><label hide-sm=\"\">Google Authenticator code</label> <label hide-gt-sm=\"\">Google Authenticator Code</label> <input name=\"twoFactorAuthCode\" type=\"tel\" ng-model=\"ngModel\" autocapitalize=\"off\" autocorrect=\"off\" ng-minlength=\"4\" ng-maxlength=\"250\" required=\"required\" ng-keyup=\"setCodeValid()\"><div ng-messages=\"twoFactorAuthForm.twoFactorAuthCode.$error\" ng-if=\"twoFactorAuthForm.twoFactorAuthCode.$touched\" role=\"alert\"><div ng-message=\"required\"><span hide-sm=\"hide-sm\">Please enter your verification code</span><span hide-gt-sm=\"\">Required</span></div><div ng-message=\"wrongCode\">Wrong code</div></div></md-input-container></ng-form>");
$templateCache.put("components/notices/_acquires_disabled.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Deposits are temporarily unavailable</h4><h5>Corporate accounts looking to deposit 100K or more can email support@tether.to for additional options.</h5></div>");
$templateCache.put("components/notices/_bitcoin_withdraw.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Select a fiat currency</h4><p>Bitcoin can not be withdrawn through a bank account, please select a fiat currency instead</p></div>");
$templateCache.put("components/notices/_btc_currency.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Bitcoin can\'t be added through a bank account</h4><p>Please add a fiat currency to your wallet and convert to BTC.</p></div>");
$templateCache.put("components/notices/_conv_frozen.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Conversions on your account are temporarily disabled.</h4><p>The most common triggers of a conversion hold are account password changes and the changing of certain security settings via support. Please contact support@tether.to for more information.</p></div>");
$templateCache.put("components/notices/_convert_available.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Please select BTC or USDâ‚®</h4><p>Only BTC and USDâ‚® can be converted at the moment.</p></div>");
$templateCache.put("components/notices/_convert_disabled.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Conversions are no longer available</h4><a href=\"https://tether.to/conversions-off/\" target=\"_blank\">Read more</a></div>");
$templateCache.put("components/notices/_email_verified.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Email verification required</h4><p>Please verify your email address by clicking the link that was sent to <b>{{ $root.User.account.email }}</b>.</p><br><a href=\"\" ng-click=\"sendEmailVerification()\" ng-disabled=\"sendEmailVerificationInProgress\" class=\"btn btn-primary\">Resend Email</a></div>");
$templateCache.put("components/notices/_geo_block.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Important Access Information</h4><hr><p><strong>Sorry, youâ€™ve logged in from a location that is restricted.</strong></p><p>Tether is committed to operating in a secure and transparent way, while adhering to all U.S. Government compliance and regulations.</p><p>For this reason Tether does not operate in <a href=\"{{ APP_URL }}/geo\">countries and U.S. states</a> that do not regulate virtual currencies.</p><p>Please access Tether through our exchange partner <a href=\"https://www.bitfinex.com/\" target=\"_blank\">Bitfinex</a>, for now.</p></div>");
$templateCache.put("components/notices/_has_balance.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> You have insufficient funds</h4><p>You need to have a positive balance before you can send.</p></div>");
$templateCache.put("components/notices/_has_balance_convert.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Conversions can\'t currently be made</h4><p>Please add funds to your wallet to make a conversion.</p></div>");
$templateCache.put("components/notices/_kyc_pending.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Your account verification is incomplete</h4><p>You can check your progress on the <a href=\"\" ui-sref=\"layout_app.kyc\">Verification page</a>.</p><p>If you have any further questions about progress of verification,please contact us at <a href=\"mailto:compliance@tether.to\">compliance@tether.to</a>.</p></div>");
$templateCache.put("components/notices/_kyc_verified.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Your account is not verified</h4><p>You can verify your account on the <a href=\"\" ui-sref=\"layout_app.kyc\">Verification page</a>.</p></div>");
$templateCache.put("components/notices/_min_balance.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Balance is too low</h4><p>A minimum of {{ minimalWithdrawBalance | money:$root.Wallet.selectedBalance.iso }} is required to request a redemption via a wire transfer</p></div>");
$templateCache.put("components/notices/_no_activity.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> You don\'t have any transactions</h4><p>You need to add or receive money to see activity.</p></div>");
$templateCache.put("components/notices/_redeems_disabled.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Withdrawals are currently restricted</h4><h5>Due to regulatory and banking limitations, withdrawals are restricted to verified corporate customers requesting 50k or more which are not in a restricted location. If you believe you can meet these requirements email support@tether.to with your request information/details.</h5></div>");
$templateCache.put("components/notices/_two_factor_auth.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Two-factor authentication required</h4><p>You can enable Two-Factor authentication on the <a href=\"\" ui-sref=\"layout_guest.2fa\">Security page</a>.</p></div>");
$templateCache.put("components/notices/_tx_frozen.html","<div class=\"alert alert-lg alert-warning\"><h4><i class=\"fa fa-exclamation-triangle\"></i> Withdrawals on your account are temporarily disabled.</h4><p>The most common triggers of a withdrawal hold are account password changes and the changing of certain security settings via support. Please contact support@tether.to for more information.</p></div>");
$templateCache.put("components/password_strength/password_strength.html","<div ng-if=\"model.password\" ng-class=\"{\'very-weak\': model.passStrength &lt; 25, \'weak\': model.passStrength &gt;= 25 &amp;&amp; model.passStrength &lt; 50, \'good\': model.passStrength &gt;= 50 &amp;&amp; model.passStrength &lt; 83, \'strong\': model.passStrength &gt;= 83}\" class=\"password-strength\"><small>Password Strength: &nbsp;<span ng-if=\"model.passStrength &lt; 25\">Very Weak</span><span ng-if=\"model.passStrength &gt;= 25 &amp;&amp; model.passStrength &lt; 50\">Weak</span><span ng-if=\"model.passStrength &gt;= 50 &amp;&amp; model.passStrength &lt; 83\">Good</span><span ng-if=\"model.passStrength &gt;= 83\">Strong</span></small><md-progress-linear md-mode=\"determinate\" value=\"{{ model.passStrength }}\"></md-progress-linear><div ng-password-strength=\"model.password\" strength=\"model.passStrength\" hide=\"\"></div></div>");
$templateCache.put("components/two_factor_auth/two_factor_auth.html","<ng-form name=\"twoFactorAuthForm\" class=\"two-factor-auth\"><md-input-container class=\"code\"><label hide-sm=\"\">Authy verification code</label> <label hide-gt-sm=\"\">Authy Code</label> <input name=\"twoFactorAuthCode\" type=\"tel\" ng-model=\"ngModel\" autocapitalize=\"off\" autocorrect=\"off\" ng-minlength=\"4\" ng-maxlength=\"250\" required=\"required\" ng-keyup=\"setCodeValid()\"><div ng-messages=\"twoFactorAuthForm.twoFactorAuthCode.$error\" ng-if=\"twoFactorAuthForm.twoFactorAuthCode.$touched\" role=\"alert\"><div ng-message=\"required\"><span hide-sm=\"hide-sm\">Please enter your verification code</span><span hide-gt-sm=\"\">Required</span></div><div ng-message=\"wrongCode\">Wrong code</div></div></md-input-container><md-input-container class=\"resend\"><md-button type=\"button\" ng-disabled=\"smsInProgress || smsSent\" ng-click=\"!smsInProgress &amp;&amp; !smsSent &amp;&amp; sendSms()\" class=\"md-primary\"><span ng-if=\"!smsInProgress &amp;&amp; !smsSent\">Send SMS</span><span ng-if=\"smsInProgress\">Sending...</span><span ng-if=\"smsSent &amp;&amp; !force\">Code was sent</span><span ng-if=\"smsSent &amp;&amp; force\">SMS was sent</span></md-button></md-input-container></ng-form>");
$templateCache.put("components/two_factor_auth_login/two_factor_auth.html","<ng-form name=\"twoFactorAuthLoginForm\" layout=\"row\" class=\"two-factor-auth-login\"><md-input-container flex=\"flex\" id=\"auth_input_container\" class=\"code\"><label hide-sm=\"\">Authy verification code</label> <label hide-gt-sm=\"\">Authy Code</label> <input name=\"twoFactorAuthCode\" type=\"tel\" ng-model=\"ngModel\" autocapitalize=\"off\" autocorrect=\"off\" ng-minlength=\"4\" ng-maxlength=\"250\" required=\"required\" ng-keyup=\"setCodeValid()\"><div ng-messages=\"twoFactorAuthLoginForm.twoFactorAuthCode.$error\" ng-if=\"twoFactorAuthLoginForm.twoFactorAuthCode.$touched\" role=\"alert\"><div ng-message=\"required\"><span hide-sm=\"hide-sm\">Please enter your verification code</span><span hide-gt-sm=\"\">Required</span></div><div ng-message=\"wrongCode\">Wrong code</div></div></md-input-container><md-input-container class=\"resend\"><md-button type=\"button\" ng-disabled=\"smsInProgress || smsSent\" ng-click=\"!smsInProgress &amp;&amp; !smsSent &amp;&amp; sendSmsLogin(true)\" class=\"md-primary\"><span ng-if=\"!smsInProgress &amp;&amp; !smsSent\">Send SMS</span><span ng-if=\"smsInProgress\">Sending...</span><span ng-if=\"smsSent &amp;&amp; !force\">Code was sent</span><span ng-if=\"smsSent &amp;&amp; force\">SMS was sent</span></md-button></md-input-container></ng-form>");}]);
