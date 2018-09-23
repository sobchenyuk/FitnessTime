import Index from './component/NavBarFixed'

import './component/carousel';

const LAZY =  document.querySelectorAll('.lazy');
const images = item => {
    item.src = item.getAttribute('data-src');
    item.removeAttribute('data-src');
};

window.addEventListener('load', () => {
    LAZY.forEach(images);
    new Index(document.querySelector('#navbar')).run();
});