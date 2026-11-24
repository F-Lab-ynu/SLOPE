// 「⋯」ボタン：その行・カードの右クリックと同じメニューを開く
(function () {
  window.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.rmore'); if (!b) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var ft = b.closest('.ft'), el = b.closest('.fcard') || b.closest('.p2r') || (ft && ft.querySelector('.ftn')) || b.closest('.evr'); if (!el) return;
    var r = b.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left, clientY: r.bottom + 2, button: 2 }));
  }, true);
})();
