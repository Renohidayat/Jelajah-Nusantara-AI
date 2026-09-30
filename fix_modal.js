const fs = require('fs');
let js = fs.readFileSync('frontend/src/main.js', 'utf8');

js = js.replace(/overlay\.classList\.remove\('hidden'\)/, 
`overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Focus trap
    const modalBox = overlay.querySelector('.modal-box');
    if(modalBox) {
        modalBox.setAttribute('tabindex', '-1');
        modalBox.focus();
    }
    
    // Global Esc listener
    window._modalEscListener = function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    };
    document.addEventListener('keydown', window._modalEscListener);`);

js = js.replace(/window\.closeModal = function \(\) \{([\s\S]*?)\}/,
`window.closeModal = function () {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = '';
    
    document.body.classList.remove('modal-open');
    if (window._modalEscListener) {
        document.removeEventListener('keydown', window._modalEscListener);
        window._modalEscListener = null;
    }
}`);

fs.writeFileSync('frontend/src/main.js', js);
console.log('Modal logic added');
