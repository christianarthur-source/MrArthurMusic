/* Shared header strip for the plain-HTML sub-sites. Add to a page, right after <body>:
     <script src="/suite/suite-header.js" data-name="MIDI MUSIC" data-icon="🎹" data-help="One short sentence of help."></script>
   Shows: "← Music Lab" (same words and place as the main app) · tool icon + name · sign-in state · "?" help.
   It only READS the saved student name to show who is signed in; it never writes it, never sends anything,
   and never touches the page's own saved settings. Sign-in itself stays on the Music Lab page. */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script || document.querySelector('.suite-header')) return;
  var name = script.getAttribute('data-name') || document.title.split(/\s[·|—-]\s/)[0] || 'Music Lab';
  var icon = script.getAttribute('data-icon') || '';
  var help = script.getAttribute('data-help') || '';
  // A page that already has its own help button can name it here; the "?" then presses that button.
  var helpClick = script.getAttribute('data-help-click') || '';
  var SESSION_KEY = 'staff_composer_student_session_v1'; // same key the Music Lab uses (read only)

  // Pages should also link the stylesheet in their <head> (no flash); this adds it if they did not.
  if (!document.querySelector('link[href$="suite-header.css"]')) {
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = script.src.replace(/[^/]*$/, '') + 'suite-header.css';
    document.head.appendChild(css);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var firstName = '';
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    var s = raw && JSON.parse(raw);
    if (s && s.id && typeof s.firstName === 'string') firstName = s.firstName.slice(0, 24);
  } catch (e) { /* storage blocked: show as not signed in */ }

  var bar = el('header', 'suite-header');
  bar.setAttribute('aria-label', 'Mr. Arthur’s Music Lab');

  var home = el('a', 'suite-home');
  home.href = '/';
  home.title = 'Back to Mr. Arthur’s Music Lab';
  home.appendChild(el('span', 'suite-arrow', '←'));
  home.appendChild(el('span', '', 'Music Lab'));
  bar.appendChild(home);

  var title = el('span', 'suite-name');
  if (icon) { var ic = el('span', 'suite-icon', icon); ic.setAttribute('aria-hidden', 'true'); title.appendChild(ic); }
  title.appendChild(el('span', 'suite-label', name));
  bar.appendChild(title);
  bar.appendChild(el('span', 'suite-spacer'));

  var chip = el('a', 'suite-chip' + (firstName ? ' signed-in' : ''));
  chip.href = '/';
  chip.title = firstName ? 'Signed in as ' + firstName + '. Open the Music Lab to see your songs or sign out.' : 'Open the Music Lab to sign in.';
  chip.appendChild(el('span', '', firstName || 'Student Sign In'));
  bar.appendChild(chip);

  if (helpClick) {
    var q2 = el('button', 'suite-help', '?');
    q2.type = 'button';
    q2.setAttribute('aria-label', 'Help');
    q2.addEventListener('click', function () {
      var target = document.querySelector(helpClick);
      if (target) target.click();
    });
    bar.appendChild(q2);
  } else if (help) {
    var q = el('button', 'suite-help', '?');
    q.type = 'button';
    q.setAttribute('aria-label', 'Help');
    q.setAttribute('aria-expanded', 'false');
    var box = el('div', 'suite-helpbox', help);
    box.hidden = true;
    q.addEventListener('click', function () {
      box.hidden = !box.hidden;
      q.setAttribute('aria-expanded', String(!box.hidden));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) { box.hidden = true; q.setAttribute('aria-expanded', 'false'); }
    });
    bar.appendChild(q);
    bar.appendChild(box);
  }

  document.body.insertBefore(bar, document.body.firstChild);
  // Pages that fill the whole window subtract this from their height so the strip does not push them off screen.
  document.documentElement.style.setProperty('--suite-header-h', '40px');
})();
