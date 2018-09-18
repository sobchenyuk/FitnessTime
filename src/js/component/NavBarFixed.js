export default class NavBarFixed {

    constructor(element) {
        this.element = element;
        this.h = element.clientHeight;
    }

    fixedBlock = element => {
        if($(window).scrollTop() > this.h){
            this.element.classList.add('fixed');
        } else {
            this.element.classList.remove('fixed');
        }
    };

    run() {
        $(window).scroll(() => {
            this.fixedBlock(this.element)
        });
    }
}