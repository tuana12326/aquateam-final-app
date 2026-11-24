// İstemci tarafı doğrulama: sunucu doğrulamasının aynısı (sunucu yine de her şeyi yeniden kontrol eder)
document.querySelectorAll('form.f[data-kind]').forEach(function (form) {
  var rules = {
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
    name: function (v) { return v.length >= 2; },
    company: function (v) { return v.length >= 2; },
    grade: function (v) { return v.length >= 3; },
    phone: function (v) { return !v || /^[+\d\s()-]{7,20}$/.test(v); },
    dept: function (v) { return !!v; },
    message: function (v, req) { return req ? v.length >= 5 : true; }
  };
  function check(el) {
    var rule = rules[el.name]; if (!rule) return true;
    var ok = rule(el.value.trim(), el.required);
    el.closest('label').classList.toggle('bad', !ok);
    return ok;
  }
  form.addEventListener('submit', function (e) {
    var firstBad = null;
    form.querySelectorAll('input[name],textarea[name],select[name]').forEach(function (el) {
      if (el.name !== 'website' && !check(el) && !firstBad) firstBad = el;
    });
    if (firstBad) { e.preventDefault(); firstBad.focus(); }
  });
  form.addEventListener('input', function (e) { if (e.target.closest('label.bad')) check(e.target); });
});
