// Phone or computer? Phones get the phone layout (class "phone" on <html>); computers keep the wide layout.
// A phone = touch screen whose short side is at most 700 CSS px. Force with ?phone or ?desktop in the address.
(function () {
  var q = location.search, phone = false;
  try {
    if (/[?&]phone/.test(q)) phone = true;
    else if (/[?&]desktop/.test(q)) phone = false;
    else phone = window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 700;
  } catch (e) {}
  if (phone) document.documentElement.classList.add("phone");
  window.IS_PHONE = phone;
})();
