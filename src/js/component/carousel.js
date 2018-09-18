import 'owl.carousel';

const callbacks = (event) =>{
    console.log(event)
};

const options = {
    loop:true,
    items:1,
    nav:true,
    dots: false,
    lazyLoad:true,
};


$(document).ready(function(){
    const owl = $('.owl-carousel');
    owl.owlCarousel(options);

    owl.on('changed.owl.carousel', callbacks);

});