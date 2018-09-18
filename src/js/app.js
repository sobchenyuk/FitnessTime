import NavBarFixed from './component/NavBarFixed'

window.addEventListener('load', () => {
    new NavBarFixed(document.querySelector('#navbar')).run();
});



import './component/carousel';