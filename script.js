// QuietTip prototype. All state lives in this object only; refreshing the page resets it.
(function () {
  'use strict';

  var PURCHASE_CENTS = 2000;
  var BASE_POOL_CENTS = 4000; // fictional starting pool for the employee demo
  var EMPLOYEE_COUNT = 4;

  var state = {
    selection: null,        // null | 'none' | '1' | '2' | '3' | 'custom'
    customText: '',
    pendingTipCents: 0,     // tip currently on the review screen
    pendingConfirmed: false,
    confirmedTipCents: 0,   // sum of all confirmed simulated tips this session
    outcomeText: '',
    feedback: []
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatCents(cents) {
    return '$' + (Math.round(cents) / 100).toFixed(2);
  }

  // ---------- Screen switching ----------

  function showScreen(name, focusId) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].hidden = true;
    }
    var screen = $('screen-' + name);
    screen.hidden = false;

    if (name === 'tip') renderTip();
    if (name === 'distribution') renderDistribution();
    if (name === 'review') renderReview();
    if (name === 'complete') renderComplete();
    if (name === 'employee') renderEmployee();

    window.scrollTo(0, 0);
    var target = focusId ? $(focusId) : screen.querySelector('h1');
    target.focus();
  }

  // ---------- Tip page ----------

  function renderTip() {
    var radios = document.querySelectorAll('input[name="tip"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].checked = radios[i].value === state.selection;
    }
    $('custom-amount').value = state.customText;
    $('custom-wrap').hidden = state.selection !== 'custom';
    renderTipSummary();
  }

  // Updates the selection summary and submit label. Never submits anything.
  function renderTipSummary() {
    var label = 'Review tip';
    var summary;
    var cents = selectedTipCents();
    if (state.selection === null) {
      label = 'Choose an option to continue';
      summary = 'No option selected yet.';
    } else if (state.selection === 'none') {
      label = 'Finish without tipping';
      summary = 'No tip selected. Your purchase is already complete.';
    } else if (cents === null) {
      summary = 'Enter a valid custom amount to review your tip.';
    } else {
      summary = 'Selected tip: ' + formatCents(cents) + '. Nothing has been submitted.';
    }
    $('tip-submit').textContent = label;
    $('tip-summary').textContent = summary;
  }

  // Returns the currently selected positive tip in cents, or null if there is none.
  function selectedTipCents() {
    if (state.selection === 'custom') {
      var result = parseCustomAmount(state.customText);
      return result.error ? null : result.cents;
    }
    if (state.selection === null || state.selection === 'none') return null;
    return parseInt(state.selection, 10) * 100;
  }

  // ---------- Tip distribution ----------

  // Splits cents into equal shares; leftover cents go to the first shares in order.
  function splitCents(cents, count) {
    var base = Math.floor(cents / count);
    var leftover = cents % count;
    var shares = [];
    for (var i = 0; i < count; i++) {
      shares.push(base + (i < leftover ? 1 : 0));
    }
    return shares;
  }

  function renderDistribution() {
    var cents = selectedTipCents();
    var isPreview = cents !== null;
    if (!isPreview) cents = 200;
    var shares = splitCents(cents, EMPLOYEE_COUNT);
    var suffix = isPreview ? ' (preview)' : ' (example)';

    $('dist-preview-label').textContent = isPreview
      ? 'Preview of your selected tip. Nothing has been submitted.'
      : 'Example: a $2 tip gives each of four employees $0.50.';
    $('dist-pool-amount').textContent = (isPreview ? 'Your selected tip (preview): ' : 'Example tip: ') + formatCents(cents);
    var boxes = document.querySelectorAll('.dist-share');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].textContent = formatCents(shares[i]) + suffix;
    }
    $('dist-rounding').hidden = cents % EMPLOYEE_COUNT === 0;
  }

  function setError(el, message) {
    el.textContent = message;
    el.hidden = !message;
  }

  function clearTipErrors() {
    setError($('tip-error'), '');
    setError($('custom-error'), '');
    $('custom-amount').removeAttribute('aria-invalid');
  }

  // Returns { cents } on success or { error } with an explanation.
  function parseCustomAmount(text) {
    var value = text.trim().replace(/^\$\s*/, '');
    if (value === '') {
      return { error: 'Enter a custom amount, or choose a different option.' };
    }
    if (/^-/.test(value)) {
      return { error: 'The amount cannot be negative. Enter an amount greater than $0.' };
    }
    if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(value)) {
      return { error: 'Use numbers only, with up to two decimal places (for example 2 or 2.50).' };
    }
    var cents = Math.round(parseFloat(value) * 100);
    if (cents <= 0) {
      return { error: 'The amount must be greater than $0. To skip tipping, choose "No tip".' };
    }
    return { cents: cents };
  }

  function onTipSubmit(event) {
    event.preventDefault();
    clearTipErrors();

    if (state.selection === null) {
      setError($('tip-error'), 'Choose an option to continue, or use "Finish without tipping".');
      document.querySelector('input[name="tip"]').focus();
      return;
    }
    if (state.selection === 'none') {
      finishWithoutTip('Your purchase is complete. No tip was added.');
      return;
    }

    var cents;
    if (state.selection === 'custom') {
      var result = parseCustomAmount(state.customText);
      if (result.error) {
        setError($('custom-error'), result.error);
        $('custom-amount').setAttribute('aria-invalid', 'true');
        $('custom-amount').focus();
        return;
      }
      cents = result.cents;
    } else {
      cents = parseInt(state.selection, 10) * 100;
    }

    state.pendingTipCents = cents;
    state.pendingConfirmed = false;
    showScreen('review');
  }

  // ---------- Review ----------

  function renderReview() {
    $('review-tip').textContent = formatCents(state.pendingTipCents);
    $('review-total').textContent = formatCents(PURCHASE_CENTS + state.pendingTipCents);
    $('confirm-btn').disabled = state.pendingConfirmed;
  }

  function confirmTip() {
    // Guard against double clicks or repeated activation counting the same tip twice.
    if (state.pendingConfirmed || state.pendingTipCents <= 0) return;
    state.pendingConfirmed = true;
    $('confirm-btn').disabled = true;
    state.confirmedTipCents += state.pendingTipCents;
    state.outcomeText = 'Your purchase is complete. A simulated tip of ' +
      formatCents(state.pendingTipCents) + ' was recorded as a separate demo payment.';
    resetTipSelection();
    showScreen('complete');
  }

  // ---------- Completion and feedback ----------

  function resetTipSelection() {
    state.selection = null;
    state.customText = '';
    state.pendingTipCents = 0;
    clearTipErrors();
  }

  function finishWithoutTip(text, focusId) {
    resetTipSelection();
    state.outcomeText = text;
    showScreen('complete', focusId);
  }

  function renderComplete() {
    $('complete-summary').textContent = state.outcomeText;
  }

  function resetFeedbackForm() {
    $('fb-worked').value = '';
    $('fb-improve').value = '';
    setError($('fb-error'), '');
    $('fb-confirm').textContent = '';
    $('fb-skip').hidden = false;
    $('feedback-form').hidden = false;
    $('fb-done').hidden = true;
  }

  function onFeedbackSubmit(event) {
    event.preventDefault();
    var worked = $('fb-worked').value.trim();
    var improve = $('fb-improve').value.trim();
    $('fb-confirm').textContent = '';

    if (!worked && !improve) {
      setError($('fb-error'), 'Enter feedback in at least one field, or skip feedback. Feedback is optional.');
      $('fb-worked').focus();
      return;
    }

    setError($('fb-error'), '');
    state.feedback.push({ worked: worked, improve: improve });
    $('fb-worked').value = '';
    $('fb-improve').value = '';
    $('fb-skip').hidden = true;
    $('feedback-form').hidden = true;
    $('fb-done').hidden = false;
    $('fb-confirm').textContent = 'Feedback submitted (simulated). It was not sent anywhere and is kept only until refresh.';
    $('fb-confirm').focus();
  }

  // ---------- Employee demo ----------

  function renderEmployee() {
    var pool = BASE_POOL_CENTS + state.confirmedTipCents;
    var shares = splitCents(pool, EMPLOYEE_COUNT);
    var isEven = pool % EMPLOYEE_COUNT === 0;
    $('emp-start').textContent = formatCents(BASE_POOL_CENTS);
    $('emp-added').textContent = formatCents(state.confirmedTipCents);
    $('emp-pool').textContent = formatCents(pool);
    $('emp-share-label').textContent = isEven
      ? 'Equal share per employee (fictional)'
      : 'Shares divided as evenly as possible (fictional)';
    // splitCents puts the larger shares first.
    $('emp-share').textContent = isEven
      ? formatCents(shares[0])
      : formatCents(shares[EMPLOYEE_COUNT - 1]) + ' to ' + formatCents(shares[0]);
    var boxes = document.querySelectorAll('.emp-box-share');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].textContent = formatCents(shares[i]);
    }
    $('emp-rounding').hidden = isEven;
  }

  // ---------- Wiring ----------

  var actions = {
    'start-customer': function () {
      resetTipSelection();
      resetFeedbackForm();
      showScreen('receipt');
    },
    'go-employee': function () { showScreen('employee'); },
    'go-start': function () { showScreen('start'); },
    'go-final': function () { showScreen('final'); },
    'open-tip': function () { showScreen('tip'); },
    'finish-from-receipt': function () {
      finishWithoutTip('Your purchase is complete.');
    },
    'go-distribution': function () { showScreen('distribution'); },
    'return-to-tip': function () { showScreen('tip'); },
    'feedback-no-tip': function () {
      finishWithoutTip('Your purchase is complete. No tip was added.', 'fb-worked');
    },
    'finish-no-tip': function () {
      finishWithoutTip('Your purchase is complete. No tip was added.');
    },
    'edit-amount': function () { showScreen('tip'); },
    'confirm-tip': confirmTip,
    'cancel-tip': function () {
      finishWithoutTip('The tip was canceled. Your purchase is complete. No tip was added.');
    }
  };

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    actions[button.getAttribute('data-action')]();
  });

  $('tip-form').addEventListener('change', function (event) {
    if (event.target.name !== 'tip') return;
    state.selection = event.target.value;
    clearTipErrors();
    $('custom-wrap').hidden = state.selection !== 'custom';
    renderTipSummary();
  });

  $('custom-amount').addEventListener('input', function (event) {
    state.customText = event.target.value;
    setError($('custom-error'), '');
    event.target.removeAttribute('aria-invalid');
    renderTipSummary();
  });

  $('tip-form').addEventListener('submit', onTipSubmit);
  $('feedback-form').addEventListener('submit', onFeedbackSubmit);

  showScreen('start');
})();
