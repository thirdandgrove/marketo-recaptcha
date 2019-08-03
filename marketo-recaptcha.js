(function () {
  // CustomEvent polyfill for IE11/Safari10.
  if ( typeof window.CustomEvent === "function" ) return false;
  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }
  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent;
})();

(function() {
  if (typeof recaptchaSiteKey === 'undefined') {
    throw "Recaptcha site key is required."
  }

  var recaptchaLoaded = false;
  var recaptchaToken = null;
  var recaptchaWidgetId = null;
  var mktoForms = {};

  /**
   * Load recaptcha API.
   */
  var loadRecaptcha = function(callback) {
    var mktoRecaptchaScriptId = "recaptcha_api";
    if (document.getElementById(mktoRecaptchaScriptId )) {
      return;
    }

    var script = document.createElement("script");
    script.id = mktoRecaptchaScriptId;
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = 1;
    script.defer = 1;

    script.onload = script.onreadystatechange = function(_, isAbort) {
      if (isAbort || !script.readyState || (/loaded|complete/).test(script.readyState) ) {
        script.onload = script.onreadystatechange = null;
        script = undefined;

        if (!isAbort && callback) {
          callback();
        }
      }
    }

    document.body.appendChild(script);
  }

  /**
   * Recaptcha render callback.
   */
  var renderRecaptcha = function() {
    if (recaptchaWidgetId !== null) {
      // Recaptcha is already rendered.
      return;
    }

    var recaptchaContainer = document.createElement('div');
    recaptchaContainer.id = "marketo_recaptcha_widget";
    document.body.appendChild(recaptchaContainer);

    recaptchaWidgetId = grecaptcha.render(recaptchaContainer.id, {
      sitekey: recaptchaSiteKey,
      callback: 'marketoRecaptchaCallback',
      size: "invisible",
      isolated: true
    });
  }

  /**
   * Recaptcha response callback.
   *
   * Must be global to register with recaptcha.
   */
  marketoRecaptchaCallback = function(token) {
    recaptchaToken = token;
    var recaptchaEvent = new CustomEvent('recaptchaResponse', { "detail": {
      "token": token
    }});
    document.dispatchEvent(recaptchaEvent);
  }

  /**
   * Load Recaptcha.
   */
  if (!recaptchaLoaded) {
    loadRecaptcha(function() {
      grecaptcha.ready(renderRecaptcha);
      recaptchaLoaded = true;
    });
  }

  /**
   * Marketo loaded callback.
   */
  MktoForms2.whenReady(function (mktoForm) {
    // Avoid processing forms more than once.
    var formId = mktoForm.getId();
    if (typeof mktoForms[formId] !== "undefined") {
      return;
    }

    mktoForms[formId] = 'processed';

    var values = mktoForm.getValues();
    // Recaptcha is not enabled for this form.
    if (typeof values.spamCheck === "undefined") {
      return;
    }

    mktoForm.onValidate(function() {
      mktoForm.submittable(false);

      if (recaptchaToken !== null) {
        mktoForm.vals({"spamCheck" : recaptchaToken});
        mktoForm.submittable(true);
      }
      else {
        grecaptcha.execute(recaptchaWidgetId);
        document.addEventListener('recaptchaResponse', function(e) {
          if (typeof e.detail.token !== 'undefined' && e.detail.token.length) {
            mktoForm.vals({"spamCheck" : e.detail.token});
            mktoForm.submittable(true);
          }
        });
      }
    });
  });

})();
