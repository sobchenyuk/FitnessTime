(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Owl Carousel v2.3.4
 * Copyright 2013-2018 David Deutsch
 * Licensed under: SEE LICENSE IN https://github.com/OwlCarousel2/OwlCarousel2/blob/master/LICENSE
 */
/**
 * Owl carousel
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 * @todo Lazy Load Icon
 * @todo prevent animationend bubling
 * @todo itemsScaleUp
 * @todo Test Zepto
 * @todo stagePadding calculate wrong active classes
 */
;(function($, window, document, undefined) {

	/**
	 * Creates a carousel.
	 * @class The Owl Carousel.
	 * @public
	 * @param {HTMLElement|jQuery} element - The element to create the carousel for.
	 * @param {Object} [options] - The options
	 */
	function Owl(element, options) {

		/**
		 * Current settings for the carousel.
		 * @public
		 */
		this.settings = null;

		/**
		 * Current options set by the caller including defaults.
		 * @public
		 */
		this.options = $.extend({}, Owl.Defaults, options);

		/**
		 * Plugin element.
		 * @public
		 */
		this.$element = $(element);

		/**
		 * Proxied event handlers.
		 * @protected
		 */
		this._handlers = {};

		/**
		 * References to the running plugins of this carousel.
		 * @protected
		 */
		this._plugins = {};

		/**
		 * Currently suppressed events to prevent them from being retriggered.
		 * @protected
		 */
		this._supress = {};

		/**
		 * Absolute current position.
		 * @protected
		 */
		this._current = null;

		/**
		 * Animation speed in milliseconds.
		 * @protected
		 */
		this._speed = null;

		/**
		 * Coordinates of all items in pixel.
		 * @todo The name of this member is missleading.
		 * @protected
		 */
		this._coordinates = [];

		/**
		 * Current breakpoint.
		 * @todo Real media queries would be nice.
		 * @protected
		 */
		this._breakpoint = null;

		/**
		 * Current width of the plugin element.
		 */
		this._width = null;

		/**
		 * All real items.
		 * @protected
		 */
		this._items = [];

		/**
		 * All cloned items.
		 * @protected
		 */
		this._clones = [];

		/**
		 * Merge values of all items.
		 * @todo Maybe this could be part of a plugin.
		 * @protected
		 */
		this._mergers = [];

		/**
		 * Widths of all items.
		 */
		this._widths = [];

		/**
		 * Invalidated parts within the update process.
		 * @protected
		 */
		this._invalidated = {};

		/**
		 * Ordered list of workers for the update process.
		 * @protected
		 */
		this._pipe = [];

		/**
		 * Current state information for the drag operation.
		 * @todo #261
		 * @protected
		 */
		this._drag = {
			time: null,
			target: null,
			pointer: null,
			stage: {
				start: null,
				current: null
			},
			direction: null
		};

		/**
		 * Current state information and their tags.
		 * @type {Object}
		 * @protected
		 */
		this._states = {
			current: {},
			tags: {
				'initializing': [ 'busy' ],
				'animating': [ 'busy' ],
				'dragging': [ 'interacting' ]
			}
		};

		$.each([ 'onResize', 'onThrottledResize' ], $.proxy(function(i, handler) {
			this._handlers[handler] = $.proxy(this[handler], this);
		}, this));

		$.each(Owl.Plugins, $.proxy(function(key, plugin) {
			this._plugins[key.charAt(0).toLowerCase() + key.slice(1)]
				= new plugin(this);
		}, this));

		$.each(Owl.Workers, $.proxy(function(priority, worker) {
			this._pipe.push({
				'filter': worker.filter,
				'run': $.proxy(worker.run, this)
			});
		}, this));

		this.setup();
		this.initialize();
	}

	/**
	 * Default options for the carousel.
	 * @public
	 */
	Owl.Defaults = {
		items: 3,
		loop: false,
		center: false,
		rewind: false,
		checkVisibility: true,

		mouseDrag: true,
		touchDrag: true,
		pullDrag: true,
		freeDrag: false,

		margin: 0,
		stagePadding: 0,

		merge: false,
		mergeFit: true,
		autoWidth: false,

		startPosition: 0,
		rtl: false,

		smartSpeed: 250,
		fluidSpeed: false,
		dragEndSpeed: false,

		responsive: {},
		responsiveRefreshRate: 200,
		responsiveBaseElement: window,

		fallbackEasing: 'swing',
		slideTransition: '',

		info: false,

		nestedItemSelector: false,
		itemElement: 'div',
		stageElement: 'div',

		refreshClass: 'owl-refresh',
		loadedClass: 'owl-loaded',
		loadingClass: 'owl-loading',
		rtlClass: 'owl-rtl',
		responsiveClass: 'owl-responsive',
		dragClass: 'owl-drag',
		itemClass: 'owl-item',
		stageClass: 'owl-stage',
		stageOuterClass: 'owl-stage-outer',
		grabClass: 'owl-grab'
	};

	/**
	 * Enumeration for width.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Width = {
		Default: 'default',
		Inner: 'inner',
		Outer: 'outer'
	};

	/**
	 * Enumeration for types.
	 * @public
	 * @readonly
	 * @enum {String}
	 */
	Owl.Type = {
		Event: 'event',
		State: 'state'
	};

	/**
	 * Contains all registered plugins.
	 * @public
	 */
	Owl.Plugins = {};

	/**
	 * List of workers involved in the update process.
	 */
	Owl.Workers = [ {
		filter: [ 'width', 'settings' ],
		run: function() {
			this._width = this.$element.width();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = this._items && this._items[this.relative(this._current)];
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			this.$stage.children('.cloned').remove();
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var margin = this.settings.margin || '',
				grid = !this.settings.autoWidth,
				rtl = this.settings.rtl,
				css = {
					'width': 'auto',
					'margin-left': rtl ? margin : '',
					'margin-right': rtl ? '' : margin
				};

			!grid && this.$stage.children().css(css);

			cache.css = css;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var width = (this.width() / this.settings.items).toFixed(3) - this.settings.margin,
				merge = null,
				iterator = this._items.length,
				grid = !this.settings.autoWidth,
				widths = [];

			cache.items = {
				merge: false,
				width: width
			};

			while (iterator--) {
				merge = this._mergers[iterator];
				merge = this.settings.mergeFit && Math.min(merge, this.settings.items) || merge;

				cache.items.merge = merge > 1 || cache.items.merge;

				widths[iterator] = !grid ? this._items[iterator].width() : width * merge;
			}

			this._widths = widths;
		}
	}, {
		filter: [ 'items', 'settings' ],
		run: function() {
			var clones = [],
				items = this._items,
				settings = this.settings,
				// TODO: Should be computed from number of min width items in stage
				view = Math.max(settings.items * 2, 4),
				size = Math.ceil(items.length / 2) * 2,
				repeat = settings.loop && items.length ? settings.rewind ? view : Math.max(view, size) : 0,
				append = '',
				prepend = '';

			repeat /= 2;

			while (repeat > 0) {
				// Switch to only using appended clones
				clones.push(this.normalize(clones.length / 2, true));
				append = append + items[clones[clones.length - 1]][0].outerHTML;
				clones.push(this.normalize(items.length - 1 - (clones.length - 1) / 2, true));
				prepend = items[clones[clones.length - 1]][0].outerHTML + prepend;
				repeat -= 1;
			}

			this._clones = clones;

			$(append).addClass('cloned').appendTo(this.$stage);
			$(prepend).addClass('cloned').prependTo(this.$stage);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				size = this._clones.length + this._items.length,
				iterator = -1,
				previous = 0,
				current = 0,
				coordinates = [];

			while (++iterator < size) {
				previous = coordinates[iterator - 1] || 0;
				current = this._widths[this.relative(iterator)] + this.settings.margin;
				coordinates.push(previous + current * rtl);
			}

			this._coordinates = coordinates;
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function() {
			var padding = this.settings.stagePadding,
				coordinates = this._coordinates,
				css = {
					'width': Math.ceil(Math.abs(coordinates[coordinates.length - 1])) + padding * 2,
					'padding-left': padding || '',
					'padding-right': padding || ''
				};

			this.$stage.css(css);
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			var iterator = this._coordinates.length,
				grid = !this.settings.autoWidth,
				items = this.$stage.children();

			if (grid && cache.items.merge) {
				while (iterator--) {
					cache.css.width = this._widths[this.relative(iterator)];
					items.eq(iterator).css(cache.css);
				}
			} else if (grid) {
				cache.css.width = cache.items.width;
				items.css(cache.css);
			}
		}
	}, {
		filter: [ 'items' ],
		run: function() {
			this._coordinates.length < 1 && this.$stage.removeAttr('style');
		}
	}, {
		filter: [ 'width', 'items', 'settings' ],
		run: function(cache) {
			cache.current = cache.current ? this.$stage.children().index(cache.current) : 0;
			cache.current = Math.max(this.minimum(), Math.min(this.maximum(), cache.current));
			this.reset(cache.current);
		}
	}, {
		filter: [ 'position' ],
		run: function() {
			this.animate(this.coordinates(this._current));
		}
	}, {
		filter: [ 'width', 'position', 'items', 'settings' ],
		run: function() {
			var rtl = this.settings.rtl ? 1 : -1,
				padding = this.settings.stagePadding * 2,
				begin = this.coordinates(this.current()) + padding,
				end = begin + this.width() * rtl,
				inner, outer, matches = [], i, n;

			for (i = 0, n = this._coordinates.length; i < n; i++) {
				inner = this._coordinates[i - 1] || 0;
				outer = Math.abs(this._coordinates[i]) + padding * rtl;

				if ((this.op(inner, '<=', begin) && (this.op(inner, '>', end)))
					|| (this.op(outer, '<', begin) && this.op(outer, '>', end))) {
					matches.push(i);
				}
			}

			this.$stage.children('.active').removeClass('active');
			this.$stage.children(':eq(' + matches.join('), :eq(') + ')').addClass('active');

			this.$stage.children('.center').removeClass('center');
			if (this.settings.center) {
				this.$stage.children().eq(this.current()).addClass('center');
			}
		}
	} ];

	/**
	 * Create the stage DOM element
	 */
	Owl.prototype.initializeStage = function() {
		this.$stage = this.$element.find('.' + this.settings.stageClass);

		// if the stage is already in the DOM, grab it and skip stage initialization
		if (this.$stage.length) {
			return;
		}

		this.$element.addClass(this.options.loadingClass);

		// create stage
		this.$stage = $('<' + this.settings.stageElement + '>', {
			"class": this.settings.stageClass
		}).wrap( $( '<div/>', {
			"class": this.settings.stageOuterClass
		}));

		// append stage
		this.$element.append(this.$stage.parent());
	};

	/**
	 * Create item DOM elements
	 */
	Owl.prototype.initializeItems = function() {
		var $items = this.$element.find('.owl-item');

		// if the items are already in the DOM, grab them and skip item initialization
		if ($items.length) {
			this._items = $items.get().map(function(item) {
				return $(item);
			});

			this._mergers = this._items.map(function() {
				return 1;
			});

			this.refresh();

			return;
		}

		// append content
		this.replace(this.$element.children().not(this.$stage.parent()));

		// check visibility
		if (this.isVisible()) {
			// update view
			this.refresh();
		} else {
			// invalidate width
			this.invalidate('width');
		}

		this.$element
			.removeClass(this.options.loadingClass)
			.addClass(this.options.loadedClass);
	};

	/**
	 * Initializes the carousel.
	 * @protected
	 */
	Owl.prototype.initialize = function() {
		this.enter('initializing');
		this.trigger('initialize');

		this.$element.toggleClass(this.settings.rtlClass, this.settings.rtl);

		if (this.settings.autoWidth && !this.is('pre-loading')) {
			var imgs, nestedSelector, width;
			imgs = this.$element.find('img');
			nestedSelector = this.settings.nestedItemSelector ? '.' + this.settings.nestedItemSelector : undefined;
			width = this.$element.children(nestedSelector).width();

			if (imgs.length && width <= 0) {
				this.preloadAutoWidthImages(imgs);
			}
		}

		this.initializeStage();
		this.initializeItems();

		// register event handlers
		this.registerEventHandlers();

		this.leave('initializing');
		this.trigger('initialized');
	};

	/**
	 * @returns {Boolean} visibility of $element
	 *                    if you know the carousel will always be visible you can set `checkVisibility` to `false` to
	 *                    prevent the expensive browser layout forced reflow the $element.is(':visible') does
	 */
	Owl.prototype.isVisible = function() {
		return this.settings.checkVisibility
			? this.$element.is(':visible')
			: true;
	};

	/**
	 * Setups the current settings.
	 * @todo Remove responsive classes. Why should adaptive designs be brought into IE8?
	 * @todo Support for media queries by using `matchMedia` would be nice.
	 * @public
	 */
	Owl.prototype.setup = function() {
		var viewport = this.viewport(),
			overwrites = this.options.responsive,
			match = -1,
			settings = null;

		if (!overwrites) {
			settings = $.extend({}, this.options);
		} else {
			$.each(overwrites, function(breakpoint) {
				if (breakpoint <= viewport && breakpoint > match) {
					match = Number(breakpoint);
				}
			});

			settings = $.extend({}, this.options, overwrites[match]);
			if (typeof settings.stagePadding === 'function') {
				settings.stagePadding = settings.stagePadding();
			}
			delete settings.responsive;

			// responsive class
			if (settings.responsiveClass) {
				this.$element.attr('class',
					this.$element.attr('class').replace(new RegExp('(' + this.options.responsiveClass + '-)\\S+\\s', 'g'), '$1' + match)
				);
			}
		}

		this.trigger('change', { property: { name: 'settings', value: settings } });
		this._breakpoint = match;
		this.settings = settings;
		this.invalidate('settings');
		this.trigger('changed', { property: { name: 'settings', value: this.settings } });
	};

	/**
	 * Updates option logic if necessery.
	 * @protected
	 */
	Owl.prototype.optionsLogic = function() {
		if (this.settings.autoWidth) {
			this.settings.stagePadding = false;
			this.settings.merge = false;
		}
	};

	/**
	 * Prepares an item before add.
	 * @todo Rename event parameter `content` to `item`.
	 * @protected
	 * @returns {jQuery|HTMLElement} - The item container.
	 */
	Owl.prototype.prepare = function(item) {
		var event = this.trigger('prepare', { content: item });

		if (!event.data) {
			event.data = $('<' + this.settings.itemElement + '/>')
				.addClass(this.options.itemClass).append(item)
		}

		this.trigger('prepared', { content: event.data });

		return event.data;
	};

	/**
	 * Updates the view.
	 * @public
	 */
	Owl.prototype.update = function() {
		var i = 0,
			n = this._pipe.length,
			filter = $.proxy(function(p) { return this[p] }, this._invalidated),
			cache = {};

		while (i < n) {
			if (this._invalidated.all || $.grep(this._pipe[i].filter, filter).length > 0) {
				this._pipe[i].run(cache);
			}
			i++;
		}

		this._invalidated = {};

		!this.is('valid') && this.enter('valid');
	};

	/**
	 * Gets the width of the view.
	 * @public
	 * @param {Owl.Width} [dimension=Owl.Width.Default] - The dimension to return.
	 * @returns {Number} - The width of the view in pixel.
	 */
	Owl.prototype.width = function(dimension) {
		dimension = dimension || Owl.Width.Default;
		switch (dimension) {
			case Owl.Width.Inner:
			case Owl.Width.Outer:
				return this._width;
			default:
				return this._width - this.settings.stagePadding * 2 + this.settings.margin;
		}
	};

	/**
	 * Refreshes the carousel primarily for adaptive purposes.
	 * @public
	 */
	Owl.prototype.refresh = function() {
		this.enter('refreshing');
		this.trigger('refresh');

		this.setup();

		this.optionsLogic();

		this.$element.addClass(this.options.refreshClass);

		this.update();

		this.$element.removeClass(this.options.refreshClass);

		this.leave('refreshing');
		this.trigger('refreshed');
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onThrottledResize = function() {
		window.clearTimeout(this.resizeTimer);
		this.resizeTimer = window.setTimeout(this._handlers.onResize, this.settings.responsiveRefreshRate);
	};

	/**
	 * Checks window `resize` event.
	 * @protected
	 */
	Owl.prototype.onResize = function() {
		if (!this._items.length) {
			return false;
		}

		if (this._width === this.$element.width()) {
			return false;
		}

		if (!this.isVisible()) {
			return false;
		}

		this.enter('resizing');

		if (this.trigger('resize').isDefaultPrevented()) {
			this.leave('resizing');
			return false;
		}

		this.invalidate('width');

		this.refresh();

		this.leave('resizing');
		this.trigger('resized');
	};

	/**
	 * Registers event handlers.
	 * @todo Check `msPointerEnabled`
	 * @todo #261
	 * @protected
	 */
	Owl.prototype.registerEventHandlers = function() {
		if ($.support.transition) {
			this.$stage.on($.support.transition.end + '.owl.core', $.proxy(this.onTransitionEnd, this));
		}

		if (this.settings.responsive !== false) {
			this.on(window, 'resize', this._handlers.onThrottledResize);
		}

		if (this.settings.mouseDrag) {
			this.$element.addClass(this.options.dragClass);
			this.$stage.on('mousedown.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('dragstart.owl.core selectstart.owl.core', function() { return false });
		}

		if (this.settings.touchDrag){
			this.$stage.on('touchstart.owl.core', $.proxy(this.onDragStart, this));
			this.$stage.on('touchcancel.owl.core', $.proxy(this.onDragEnd, this));
		}
	};

	/**
	 * Handles `touchstart` and `mousedown` events.
	 * @todo Horizontal swipe threshold as option
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragStart = function(event) {
		var stage = null;

		if (event.which === 3) {
			return;
		}

		if ($.support.transform) {
			stage = this.$stage.css('transform').replace(/.*\(|\)| /g, '').split(',');
			stage = {
				x: stage[stage.length === 16 ? 12 : 4],
				y: stage[stage.length === 16 ? 13 : 5]
			};
		} else {
			stage = this.$stage.position();
			stage = {
				x: this.settings.rtl ?
					stage.left + this.$stage.width() - this.width() + this.settings.margin :
					stage.left,
				y: stage.top
			};
		}

		if (this.is('animating')) {
			$.support.transform ? this.animate(stage.x) : this.$stage.stop()
			this.invalidate('position');
		}

		this.$element.toggleClass(this.options.grabClass, event.type === 'mousedown');

		this.speed(0);

		this._drag.time = new Date().getTime();
		this._drag.target = $(event.target);
		this._drag.stage.start = stage;
		this._drag.stage.current = stage;
		this._drag.pointer = this.pointer(event);

		$(document).on('mouseup.owl.core touchend.owl.core', $.proxy(this.onDragEnd, this));

		$(document).one('mousemove.owl.core touchmove.owl.core', $.proxy(function(event) {
			var delta = this.difference(this._drag.pointer, this.pointer(event));

			$(document).on('mousemove.owl.core touchmove.owl.core', $.proxy(this.onDragMove, this));

			if (Math.abs(delta.x) < Math.abs(delta.y) && this.is('valid')) {
				return;
			}

			event.preventDefault();

			this.enter('dragging');
			this.trigger('drag');
		}, this));
	};

	/**
	 * Handles the `touchmove` and `mousemove` events.
	 * @todo #261
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragMove = function(event) {
		var minimum = null,
			maximum = null,
			pull = null,
			delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this.difference(this._drag.stage.start, delta);

		if (!this.is('dragging')) {
			return;
		}

		event.preventDefault();

		if (this.settings.loop) {
			minimum = this.coordinates(this.minimum());
			maximum = this.coordinates(this.maximum() + 1) - minimum;
			stage.x = (((stage.x - minimum) % maximum + maximum) % maximum) + minimum;
		} else {
			minimum = this.settings.rtl ? this.coordinates(this.maximum()) : this.coordinates(this.minimum());
			maximum = this.settings.rtl ? this.coordinates(this.minimum()) : this.coordinates(this.maximum());
			pull = this.settings.pullDrag ? -1 * delta.x / 5 : 0;
			stage.x = Math.max(Math.min(stage.x, minimum + pull), maximum + pull);
		}

		this._drag.stage.current = stage;

		this.animate(stage.x);
	};

	/**
	 * Handles the `touchend` and `mouseup` events.
	 * @todo #261
	 * @todo Threshold for click event
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onDragEnd = function(event) {
		var delta = this.difference(this._drag.pointer, this.pointer(event)),
			stage = this._drag.stage.current,
			direction = delta.x > 0 ^ this.settings.rtl ? 'left' : 'right';

		$(document).off('.owl.core');

		this.$element.removeClass(this.options.grabClass);

		if (delta.x !== 0 && this.is('dragging') || !this.is('valid')) {
			this.speed(this.settings.dragEndSpeed || this.settings.smartSpeed);
			this.current(this.closest(stage.x, delta.x !== 0 ? direction : this._drag.direction));
			this.invalidate('position');
			this.update();

			this._drag.direction = direction;

			if (Math.abs(delta.x) > 3 || new Date().getTime() - this._drag.time > 300) {
				this._drag.target.one('click.owl.core', function() { return false; });
			}
		}

		if (!this.is('dragging')) {
			return;
		}

		this.leave('dragging');
		this.trigger('dragged');
	};

	/**
	 * Gets absolute position of the closest item for a coordinate.
	 * @todo Setting `freeDrag` makes `closest` not reusable. See #165.
	 * @protected
	 * @param {Number} coordinate - The coordinate in pixel.
	 * @param {String} direction - The direction to check for the closest item. Ether `left` or `right`.
	 * @return {Number} - The absolute position of the closest item.
	 */
	Owl.prototype.closest = function(coordinate, direction) {
		var position = -1,
			pull = 30,
			width = this.width(),
			coordinates = this.coordinates();

		if (!this.settings.freeDrag) {
			// check closest item
			$.each(coordinates, $.proxy(function(index, value) {
				// on a left pull, check on current index
				if (direction === 'left' && coordinate > value - pull && coordinate < value + pull) {
					position = index;
				// on a right pull, check on previous index
				// to do so, subtract width from value and set position = index + 1
				} else if (direction === 'right' && coordinate > value - width - pull && coordinate < value - width + pull) {
					position = index + 1;
				} else if (this.op(coordinate, '<', value)
					&& this.op(coordinate, '>', coordinates[index + 1] !== undefined ? coordinates[index + 1] : value - width)) {
					position = direction === 'left' ? index + 1 : index;
				}
				return position === -1;
			}, this));
		}

		if (!this.settings.loop) {
			// non loop boundries
			if (this.op(coordinate, '>', coordinates[this.minimum()])) {
				position = coordinate = this.minimum();
			} else if (this.op(coordinate, '<', coordinates[this.maximum()])) {
				position = coordinate = this.maximum();
			}
		}

		return position;
	};

	/**
	 * Animates the stage.
	 * @todo #270
	 * @public
	 * @param {Number} coordinate - The coordinate in pixels.
	 */
	Owl.prototype.animate = function(coordinate) {
		var animate = this.speed() > 0;

		this.is('animating') && this.onTransitionEnd();

		if (animate) {
			this.enter('animating');
			this.trigger('translate');
		}

		if ($.support.transform3d && $.support.transition) {
			this.$stage.css({
				transform: 'translate3d(' + coordinate + 'px,0px,0px)',
				transition: (this.speed() / 1000) + 's' + (
					this.settings.slideTransition ? ' ' + this.settings.slideTransition : ''
				)
			});
		} else if (animate) {
			this.$stage.animate({
				left: coordinate + 'px'
			}, this.speed(), this.settings.fallbackEasing, $.proxy(this.onTransitionEnd, this));
		} else {
			this.$stage.css({
				left: coordinate + 'px'
			});
		}
	};

	/**
	 * Checks whether the carousel is in a specific state or not.
	 * @param {String} state - The state to check.
	 * @returns {Boolean} - The flag which indicates if the carousel is busy.
	 */
	Owl.prototype.is = function(state) {
		return this._states.current[state] && this._states.current[state] > 0;
	};

	/**
	 * Sets the absolute position of the current item.
	 * @public
	 * @param {Number} [position] - The new absolute position or nothing to leave it unchanged.
	 * @returns {Number} - The absolute position of the current item.
	 */
	Owl.prototype.current = function(position) {
		if (position === undefined) {
			return this._current;
		}

		if (this._items.length === 0) {
			return undefined;
		}

		position = this.normalize(position);

		if (this._current !== position) {
			var event = this.trigger('change', { property: { name: 'position', value: position } });

			if (event.data !== undefined) {
				position = this.normalize(event.data);
			}

			this._current = position;

			this.invalidate('position');

			this.trigger('changed', { property: { name: 'position', value: this._current } });
		}

		return this._current;
	};

	/**
	 * Invalidates the given part of the update routine.
	 * @param {String} [part] - The part to invalidate.
	 * @returns {Array.<String>} - The invalidated parts.
	 */
	Owl.prototype.invalidate = function(part) {
		if ($.type(part) === 'string') {
			this._invalidated[part] = true;
			this.is('valid') && this.leave('valid');
		}
		return $.map(this._invalidated, function(v, i) { return i });
	};

	/**
	 * Resets the absolute position of the current item.
	 * @public
	 * @param {Number} position - The absolute position of the new item.
	 */
	Owl.prototype.reset = function(position) {
		position = this.normalize(position);

		if (position === undefined) {
			return;
		}

		this._speed = 0;
		this._current = position;

		this.suppress([ 'translate', 'translated' ]);

		this.animate(this.coordinates(position));

		this.release([ 'translate', 'translated' ]);
	};

	/**
	 * Normalizes an absolute or a relative position of an item.
	 * @public
	 * @param {Number} position - The absolute or relative position to normalize.
	 * @param {Boolean} [relative=false] - Whether the given position is relative or not.
	 * @returns {Number} - The normalized position.
	 */
	Owl.prototype.normalize = function(position, relative) {
		var n = this._items.length,
			m = relative ? 0 : this._clones.length;

		if (!this.isNumeric(position) || n < 1) {
			position = undefined;
		} else if (position < 0 || position >= n + m) {
			position = ((position - m / 2) % n + n) % n + m / 2;
		}

		return position;
	};

	/**
	 * Converts an absolute position of an item into a relative one.
	 * @public
	 * @param {Number} position - The absolute position to convert.
	 * @returns {Number} - The converted position.
	 */
	Owl.prototype.relative = function(position) {
		position -= this._clones.length / 2;
		return this.normalize(position, true);
	};

	/**
	 * Gets the maximum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.maximum = function(relative) {
		var settings = this.settings,
			maximum = this._coordinates.length,
			iterator,
			reciprocalItemsWidth,
			elementWidth;

		if (settings.loop) {
			maximum = this._clones.length / 2 + this._items.length - 1;
		} else if (settings.autoWidth || settings.merge) {
			iterator = this._items.length;
			if (iterator) {
				reciprocalItemsWidth = this._items[--iterator].width();
				elementWidth = this.$element.width();
				while (iterator--) {
					reciprocalItemsWidth += this._items[iterator].width() + this.settings.margin;
					if (reciprocalItemsWidth > elementWidth) {
						break;
					}
				}
			}
			maximum = iterator + 1;
		} else if (settings.center) {
			maximum = this._items.length - 1;
		} else {
			maximum = this._items.length - settings.items;
		}

		if (relative) {
			maximum -= this._clones.length / 2;
		}

		return Math.max(maximum, 0);
	};

	/**
	 * Gets the minimum position for the current item.
	 * @public
	 * @param {Boolean} [relative=false] - Whether to return an absolute position or a relative position.
	 * @returns {Number}
	 */
	Owl.prototype.minimum = function(relative) {
		return relative ? 0 : this._clones.length / 2;
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.items = function(position) {
		if (position === undefined) {
			return this._items.slice();
		}

		position = this.normalize(position, true);
		return this._items[position];
	};

	/**
	 * Gets an item at the specified relative position.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @return {jQuery|Array.<jQuery>} - The item at the given position or all items if no position was given.
	 */
	Owl.prototype.mergers = function(position) {
		if (position === undefined) {
			return this._mergers.slice();
		}

		position = this.normalize(position, true);
		return this._mergers[position];
	};

	/**
	 * Gets the absolute positions of clones for an item.
	 * @public
	 * @param {Number} [position] - The relative position of the item.
	 * @returns {Array.<Number>} - The absolute positions of clones for the item or all if no position was given.
	 */
	Owl.prototype.clones = function(position) {
		var odd = this._clones.length / 2,
			even = odd + this._items.length,
			map = function(index) { return index % 2 === 0 ? even + index / 2 : odd - (index + 1) / 2 };

		if (position === undefined) {
			return $.map(this._clones, function(v, i) { return map(i) });
		}

		return $.map(this._clones, function(v, i) { return v === position ? map(i) : null });
	};

	/**
	 * Sets the current animation speed.
	 * @public
	 * @param {Number} [speed] - The animation speed in milliseconds or nothing to leave it unchanged.
	 * @returns {Number} - The current animation speed in milliseconds.
	 */
	Owl.prototype.speed = function(speed) {
		if (speed !== undefined) {
			this._speed = speed;
		}

		return this._speed;
	};

	/**
	 * Gets the coordinate of an item.
	 * @todo The name of this method is missleanding.
	 * @public
	 * @param {Number} position - The absolute position of the item within `minimum()` and `maximum()`.
	 * @returns {Number|Array.<Number>} - The coordinate of the item in pixel or all coordinates.
	 */
	Owl.prototype.coordinates = function(position) {
		var multiplier = 1,
			newPosition = position - 1,
			coordinate;

		if (position === undefined) {
			return $.map(this._coordinates, $.proxy(function(coordinate, index) {
				return this.coordinates(index);
			}, this));
		}

		if (this.settings.center) {
			if (this.settings.rtl) {
				multiplier = -1;
				newPosition = position + 1;
			}

			coordinate = this._coordinates[position];
			coordinate += (this.width() - coordinate + (this._coordinates[newPosition] || 0)) / 2 * multiplier;
		} else {
			coordinate = this._coordinates[newPosition] || 0;
		}

		coordinate = Math.ceil(coordinate);

		return coordinate;
	};

	/**
	 * Calculates the speed for a translation.
	 * @protected
	 * @param {Number} from - The absolute position of the start item.
	 * @param {Number} to - The absolute position of the target item.
	 * @param {Number} [factor=undefined] - The time factor in milliseconds.
	 * @returns {Number} - The time in milliseconds for the translation.
	 */
	Owl.prototype.duration = function(from, to, factor) {
		if (factor === 0) {
			return 0;
		}

		return Math.min(Math.max(Math.abs(to - from), 1), 6) * Math.abs((factor || this.settings.smartSpeed));
	};

	/**
	 * Slides to the specified item.
	 * @public
	 * @param {Number} position - The position of the item.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.to = function(position, speed) {
		var current = this.current(),
			revert = null,
			distance = position - this.relative(current),
			direction = (distance > 0) - (distance < 0),
			items = this._items.length,
			minimum = this.minimum(),
			maximum = this.maximum();

		if (this.settings.loop) {
			if (!this.settings.rewind && Math.abs(distance) > items / 2) {
				distance += direction * -1 * items;
			}

			position = current + distance;
			revert = ((position - minimum) % items + items) % items + minimum;

			if (revert !== position && revert - distance <= maximum && revert - distance > 0) {
				current = revert - distance;
				position = revert;
				this.reset(current);
			}
		} else if (this.settings.rewind) {
			maximum += 1;
			position = (position % maximum + maximum) % maximum;
		} else {
			position = Math.max(minimum, Math.min(maximum, position));
		}

		this.speed(this.duration(current, position, speed));
		this.current(position);

		if (this.isVisible()) {
			this.update();
		}
	};

	/**
	 * Slides to the next item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.next = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) + 1, speed);
	};

	/**
	 * Slides to the previous item.
	 * @public
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 */
	Owl.prototype.prev = function(speed) {
		speed = speed || false;
		this.to(this.relative(this.current()) - 1, speed);
	};

	/**
	 * Handles the end of an animation.
	 * @protected
	 * @param {Event} event - The event arguments.
	 */
	Owl.prototype.onTransitionEnd = function(event) {

		// if css2 animation then event object is undefined
		if (event !== undefined) {
			event.stopPropagation();

			// Catch only owl-stage transitionEnd event
			if ((event.target || event.srcElement || event.originalTarget) !== this.$stage.get(0)) {
				return false;
			}
		}

		this.leave('animating');
		this.trigger('translated');
	};

	/**
	 * Gets viewport width.
	 * @protected
	 * @return {Number} - The width in pixel.
	 */
	Owl.prototype.viewport = function() {
		var width;
		if (this.options.responsiveBaseElement !== window) {
			width = $(this.options.responsiveBaseElement).width();
		} else if (window.innerWidth) {
			width = window.innerWidth;
		} else if (document.documentElement && document.documentElement.clientWidth) {
			width = document.documentElement.clientWidth;
		} else {
			console.warn('Can not detect viewport width.');
		}
		return width;
	};

	/**
	 * Replaces the current content.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The new content.
	 */
	Owl.prototype.replace = function(content) {
		this.$stage.empty();
		this._items = [];

		if (content) {
			content = (content instanceof jQuery) ? content : $(content);
		}

		if (this.settings.nestedItemSelector) {
			content = content.find('.' + this.settings.nestedItemSelector);
		}

		content.filter(function() {
			return this.nodeType === 1;
		}).each($.proxy(function(index, item) {
			item = this.prepare(item);
			this.$stage.append(item);
			this._items.push(item);
			this._mergers.push(item.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}, this));

		this.reset(this.isNumeric(this.settings.startPosition) ? this.settings.startPosition : 0);

		this.invalidate('items');
	};

	/**
	 * Adds an item.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {HTMLElement|jQuery|String} content - The item content to add.
	 * @param {Number} [position] - The relative position at which to insert the item otherwise the item will be added to the end.
	 */
	Owl.prototype.add = function(content, position) {
		var current = this.relative(this._current);

		position = position === undefined ? this._items.length : this.normalize(position, true);
		content = content instanceof jQuery ? content : $(content);

		this.trigger('add', { content: content, position: position });

		content = this.prepare(content);

		if (this._items.length === 0 || position === this._items.length) {
			this._items.length === 0 && this.$stage.append(content);
			this._items.length !== 0 && this._items[position - 1].after(content);
			this._items.push(content);
			this._mergers.push(content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		} else {
			this._items[position].before(content);
			this._items.splice(position, 0, content);
			this._mergers.splice(position, 0, content.find('[data-merge]').addBack('[data-merge]').attr('data-merge') * 1 || 1);
		}

		this._items[current] && this.reset(this._items[current].index());

		this.invalidate('items');

		this.trigger('added', { content: content, position: position });
	};

	/**
	 * Removes an item by its position.
	 * @todo Use `item` instead of `content` for the event arguments.
	 * @public
	 * @param {Number} position - The relative position of the item to remove.
	 */
	Owl.prototype.remove = function(position) {
		position = this.normalize(position, true);

		if (position === undefined) {
			return;
		}

		this.trigger('remove', { content: this._items[position], position: position });

		this._items[position].remove();
		this._items.splice(position, 1);
		this._mergers.splice(position, 1);

		this.invalidate('items');

		this.trigger('removed', { content: null, position: position });
	};

	/**
	 * Preloads images with auto width.
	 * @todo Replace by a more generic approach
	 * @protected
	 */
	Owl.prototype.preloadAutoWidthImages = function(images) {
		images.each($.proxy(function(i, element) {
			this.enter('pre-loading');
			element = $(element);
			$(new Image()).one('load', $.proxy(function(e) {
				element.attr('src', e.target.src);
				element.css('opacity', 1);
				this.leave('pre-loading');
				!this.is('pre-loading') && !this.is('initializing') && this.refresh();
			}, this)).attr('src', element.attr('src') || element.attr('data-src') || element.attr('data-src-retina'));
		}, this));
	};

	/**
	 * Destroys the carousel.
	 * @public
	 */
	Owl.prototype.destroy = function() {

		this.$element.off('.owl.core');
		this.$stage.off('.owl.core');
		$(document).off('.owl.core');

		if (this.settings.responsive !== false) {
			window.clearTimeout(this.resizeTimer);
			this.off(window, 'resize', this._handlers.onThrottledResize);
		}

		for (var i in this._plugins) {
			this._plugins[i].destroy();
		}

		this.$stage.children('.cloned').remove();

		this.$stage.unwrap();
		this.$stage.children().contents().unwrap();
		this.$stage.children().unwrap();
		this.$stage.remove();
		this.$element
			.removeClass(this.options.refreshClass)
			.removeClass(this.options.loadingClass)
			.removeClass(this.options.loadedClass)
			.removeClass(this.options.rtlClass)
			.removeClass(this.options.dragClass)
			.removeClass(this.options.grabClass)
			.attr('class', this.$element.attr('class').replace(new RegExp(this.options.responsiveClass + '-\\S+\\s', 'g'), ''))
			.removeData('owl.carousel');
	};

	/**
	 * Operators to calculate right-to-left and left-to-right.
	 * @protected
	 * @param {Number} [a] - The left side operand.
	 * @param {String} [o] - The operator.
	 * @param {Number} [b] - The right side operand.
	 */
	Owl.prototype.op = function(a, o, b) {
		var rtl = this.settings.rtl;
		switch (o) {
			case '<':
				return rtl ? a > b : a < b;
			case '>':
				return rtl ? a < b : a > b;
			case '>=':
				return rtl ? a <= b : a >= b;
			case '<=':
				return rtl ? a >= b : a <= b;
			default:
				break;
		}
	};

	/**
	 * Attaches to an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The event handler to attach.
	 * @param {Boolean} capture - Wether the event should be handled at the capturing phase or not.
	 */
	Owl.prototype.on = function(element, event, listener, capture) {
		if (element.addEventListener) {
			element.addEventListener(event, listener, capture);
		} else if (element.attachEvent) {
			element.attachEvent('on' + event, listener);
		}
	};

	/**
	 * Detaches from an internal event.
	 * @protected
	 * @param {HTMLElement} element - The event source.
	 * @param {String} event - The event name.
	 * @param {Function} listener - The attached event handler to detach.
	 * @param {Boolean} capture - Wether the attached event handler was registered as a capturing listener or not.
	 */
	Owl.prototype.off = function(element, event, listener, capture) {
		if (element.removeEventListener) {
			element.removeEventListener(event, listener, capture);
		} else if (element.detachEvent) {
			element.detachEvent('on' + event, listener);
		}
	};

	/**
	 * Triggers a public event.
	 * @todo Remove `status`, `relatedTarget` should be used instead.
	 * @protected
	 * @param {String} name - The event name.
	 * @param {*} [data=null] - The event data.
	 * @param {String} [namespace=carousel] - The event namespace.
	 * @param {String} [state] - The state which is associated with the event.
	 * @param {Boolean} [enter=false] - Indicates if the call enters the specified state or not.
	 * @returns {Event} - The event arguments.
	 */
	Owl.prototype.trigger = function(name, data, namespace, state, enter) {
		var status = {
			item: { count: this._items.length, index: this.current() }
		}, handler = $.camelCase(
			$.grep([ 'on', name, namespace ], function(v) { return v })
				.join('-').toLowerCase()
		), event = $.Event(
			[ name, 'owl', namespace || 'carousel' ].join('.').toLowerCase(),
			$.extend({ relatedTarget: this }, status, data)
		);

		if (!this._supress[name]) {
			$.each(this._plugins, function(name, plugin) {
				if (plugin.onTrigger) {
					plugin.onTrigger(event);
				}
			});

			this.register({ type: Owl.Type.Event, name: name });
			this.$element.trigger(event);

			if (this.settings && typeof this.settings[handler] === 'function') {
				this.settings[handler].call(this, event);
			}
		}

		return event;
	};

	/**
	 * Enters a state.
	 * @param name - The state name.
	 */
	Owl.prototype.enter = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			if (this._states.current[name] === undefined) {
				this._states.current[name] = 0;
			}

			this._states.current[name]++;
		}, this));
	};

	/**
	 * Leaves a state.
	 * @param name - The state name.
	 */
	Owl.prototype.leave = function(name) {
		$.each([ name ].concat(this._states.tags[name] || []), $.proxy(function(i, name) {
			this._states.current[name]--;
		}, this));
	};

	/**
	 * Registers an event or state.
	 * @public
	 * @param {Object} object - The event or state to register.
	 */
	Owl.prototype.register = function(object) {
		if (object.type === Owl.Type.Event) {
			if (!$.event.special[object.name]) {
				$.event.special[object.name] = {};
			}

			if (!$.event.special[object.name].owl) {
				var _default = $.event.special[object.name]._default;
				$.event.special[object.name]._default = function(e) {
					if (_default && _default.apply && (!e.namespace || e.namespace.indexOf('owl') === -1)) {
						return _default.apply(this, arguments);
					}
					return e.namespace && e.namespace.indexOf('owl') > -1;
				};
				$.event.special[object.name].owl = true;
			}
		} else if (object.type === Owl.Type.State) {
			if (!this._states.tags[object.name]) {
				this._states.tags[object.name] = object.tags;
			} else {
				this._states.tags[object.name] = this._states.tags[object.name].concat(object.tags);
			}

			this._states.tags[object.name] = $.grep(this._states.tags[object.name], $.proxy(function(tag, i) {
				return $.inArray(tag, this._states.tags[object.name]) === i;
			}, this));
		}
	};

	/**
	 * Suppresses events.
	 * @protected
	 * @param {Array.<String>} events - The events to suppress.
	 */
	Owl.prototype.suppress = function(events) {
		$.each(events, $.proxy(function(index, event) {
			this._supress[event] = true;
		}, this));
	};

	/**
	 * Releases suppressed events.
	 * @protected
	 * @param {Array.<String>} events - The events to release.
	 */
	Owl.prototype.release = function(events) {
		$.each(events, $.proxy(function(index, event) {
			delete this._supress[event];
		}, this));
	};

	/**
	 * Gets unified pointer coordinates from event.
	 * @todo #261
	 * @protected
	 * @param {Event} - The `mousedown` or `touchstart` event.
	 * @returns {Object} - Contains `x` and `y` coordinates of current pointer position.
	 */
	Owl.prototype.pointer = function(event) {
		var result = { x: null, y: null };

		event = event.originalEvent || event || window.event;

		event = event.touches && event.touches.length ?
			event.touches[0] : event.changedTouches && event.changedTouches.length ?
				event.changedTouches[0] : event;

		if (event.pageX) {
			result.x = event.pageX;
			result.y = event.pageY;
		} else {
			result.x = event.clientX;
			result.y = event.clientY;
		}

		return result;
	};

	/**
	 * Determines if the input is a Number or something that can be coerced to a Number
	 * @protected
	 * @param {Number|String|Object|Array|Boolean|RegExp|Function|Symbol} - The input to be tested
	 * @returns {Boolean} - An indication if the input is a Number or can be coerced to a Number
	 */
	Owl.prototype.isNumeric = function(number) {
		return !isNaN(parseFloat(number));
	};

	/**
	 * Gets the difference of two vectors.
	 * @todo #261
	 * @protected
	 * @param {Object} - The first vector.
	 * @param {Object} - The second vector.
	 * @returns {Object} - The difference.
	 */
	Owl.prototype.difference = function(first, second) {
		return {
			x: first.x - second.x,
			y: first.y - second.y
		};
	};

	/**
	 * The jQuery Plugin for the Owl Carousel
	 * @todo Navigation plugin `next` and `prev`
	 * @public
	 */
	$.fn.owlCarousel = function(option) {
		var args = Array.prototype.slice.call(arguments, 1);

		return this.each(function() {
			var $this = $(this),
				data = $this.data('owl.carousel');

			if (!data) {
				data = new Owl(this, typeof option == 'object' && option);
				$this.data('owl.carousel', data);

				$.each([
					'next', 'prev', 'to', 'destroy', 'refresh', 'replace', 'add', 'remove'
				], function(i, event) {
					data.register({ type: Owl.Type.Event, name: event });
					data.$element.on(event + '.owl.carousel.core', $.proxy(function(e) {
						if (e.namespace && e.relatedTarget !== this) {
							this.suppress([ event ]);
							data[event].apply(this, [].slice.call(arguments, 1));
							this.release([ event ]);
						}
					}, data));
				});
			}

			if (typeof option == 'string' && option.charAt(0) !== '_') {
				data[option].apply(data, args);
			}
		});
	};

	/**
	 * The constructor for the jQuery Plugin
	 * @public
	 */
	$.fn.owlCarousel.Constructor = Owl;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoRefresh Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto refresh plugin.
	 * @class The Auto Refresh Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoRefresh = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Refresh interval.
		 * @protected
		 * @type {number}
		 */
		this._interval = null;

		/**
		 * Whether the element is currently visible or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._visible = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoRefresh) {
					this.watch();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoRefresh.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	AutoRefresh.Defaults = {
		autoRefresh: true,
		autoRefreshInterval: 500
	};

	/**
	 * Watches the element.
	 */
	AutoRefresh.prototype.watch = function() {
		if (this._interval) {
			return;
		}

		this._visible = this._core.isVisible();
		this._interval = window.setInterval($.proxy(this.refresh, this), this._core.settings.autoRefreshInterval);
	};

	/**
	 * Refreshes the element.
	 */
	AutoRefresh.prototype.refresh = function() {
		if (this._core.isVisible() === this._visible) {
			return;
		}

		this._visible = !this._visible;

		this._core.$element.toggleClass('owl-hidden', !this._visible);

		this._visible && (this._core.invalidate('width') && this._core.refresh());
	};

	/**
	 * Destroys the plugin.
	 */
	AutoRefresh.prototype.destroy = function() {
		var handler, property;

		window.clearInterval(this._interval);

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoRefresh = AutoRefresh;

})(window.Zepto || window.jQuery, window, document);

/**
 * Lazy Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the lazy plugin.
	 * @class The Lazy Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Lazy = function(carousel) {

		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Already loaded items.
		 * @protected
		 * @type {Array.<jQuery>}
		 */
		this._loaded = [];

		/**
		 * Event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel change.owl.carousel resized.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				if (!this._core.settings || !this._core.settings.lazyLoad) {
					return;
				}

				if ((e.property && e.property.name == 'position') || e.type == 'initialized') {
					var settings = this._core.settings,
						n = (settings.center && Math.ceil(settings.items / 2) || settings.items),
						i = ((settings.center && n * -1) || 0),
						position = (e.property && e.property.value !== undefined ? e.property.value : this._core.current()) + i,
						clones = this._core.clones().length,
						load = $.proxy(function(i, v) { this.load(v) }, this);
					//TODO: Need documentation for this new option
					if (settings.lazyLoadEager > 0) {
						n += settings.lazyLoadEager;
						// If the carousel is looping also preload images that are to the "left"
						if (settings.loop) {
              position -= settings.lazyLoadEager;
              n++;
            }
					}

					while (i++ < n) {
						this.load(clones / 2 + this._core.relative(position));
						clones && $.each(this._core.clones(this._core.relative(position)), load);
						position++;
					}
				}
			}, this)
		};

		// set the default options
		this._core.options = $.extend({}, Lazy.Defaults, this._core.options);

		// register event handler
		this._core.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Lazy.Defaults = {
		lazyLoad: false,
		lazyLoadEager: 0
	};

	/**
	 * Loads all resources of an item at the specified position.
	 * @param {Number} position - The absolute position of the item.
	 * @protected
	 */
	Lazy.prototype.load = function(position) {
		var $item = this._core.$stage.children().eq(position),
			$elements = $item && $item.find('.owl-lazy');

		if (!$elements || $.inArray($item.get(0), this._loaded) > -1) {
			return;
		}

		$elements.each($.proxy(function(index, element) {
			var $element = $(element), image,
                url = (window.devicePixelRatio > 1 && $element.attr('data-src-retina')) || $element.attr('data-src') || $element.attr('data-srcset');

			this._core.trigger('load', { element: $element, url: url }, 'lazy');

			if ($element.is('img')) {
				$element.one('load.owl.lazy', $.proxy(function() {
					$element.css('opacity', 1);
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this)).attr('src', url);
            } else if ($element.is('source')) {
                $element.one('load.owl.lazy', $.proxy(function() {
                    this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
                }, this)).attr('srcset', url);
			} else {
				image = new Image();
				image.onload = $.proxy(function() {
					$element.css({
						'background-image': 'url("' + url + '")',
						'opacity': '1'
					});
					this._core.trigger('loaded', { element: $element, url: url }, 'lazy');
				}, this);
				image.src = url;
			}
		}, this));

		this._loaded.push($item.get(0));
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Lazy.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this._core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Lazy = Lazy;

})(window.Zepto || window.jQuery, window, document);

/**
 * AutoHeight Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the auto height plugin.
	 * @class The Auto Height Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var AutoHeight = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		this._previousHeight = null;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight) {
					this.update();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight && e.property.name === 'position'){
					this.update();
				}
			}, this),
			'loaded.owl.lazy': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoHeight
					&& e.element.closest('.' + this._core.settings.itemClass).index() === this._core.current()) {
					this.update();
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, AutoHeight.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);
		this._intervalId = null;
		var refThis = this;

		// These changes have been taken from a PR by gavrochelegnou proposed in #1575
		// and have been made compatible with the latest jQuery version
		$(window).on('load', function() {
			if (refThis._core.settings.autoHeight) {
				refThis.update();
			}
		});

		// Autoresize the height of the carousel when window is resized
		// When carousel has images, the height is dependent on the width
		// and should also change on resize
		$(window).resize(function() {
			if (refThis._core.settings.autoHeight) {
				if (refThis._intervalId != null) {
					clearTimeout(refThis._intervalId);
				}

				refThis._intervalId = setTimeout(function() {
					refThis.update();
				}, 250);
			}
		});

	};

	/**
	 * Default options.
	 * @public
	 */
	AutoHeight.Defaults = {
		autoHeight: false,
		autoHeightClass: 'owl-height'
	};

	/**
	 * Updates the view.
	 */
	AutoHeight.prototype.update = function() {
		var start = this._core._current,
			end = start + this._core.settings.items,
			lazyLoadEnabled = this._core.settings.lazyLoad,
			visible = this._core.$stage.children().toArray().slice(start, end),
			heights = [],
			maxheight = 0;

		$.each(visible, function(index, item) {
			heights.push($(item).height());
		});

		maxheight = Math.max.apply(null, heights);

		if (maxheight <= 1 && lazyLoadEnabled && this._previousHeight) {
			maxheight = this._previousHeight;
		}

		this._previousHeight = maxheight;

		this._core.$stage.parent()
			.height(maxheight)
			.addClass(this._core.settings.autoHeightClass);
	};

	AutoHeight.prototype.destroy = function() {
		var handler, property;

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] !== 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.AutoHeight = AutoHeight;

})(window.Zepto || window.jQuery, window, document);

/**
 * Video Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the video plugin.
	 * @class The Video Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Video = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Cache all video URLs.
		 * @protected
		 * @type {Object}
		 */
		this._videos = {};

		/**
		 * Current playing item.
		 * @protected
		 * @type {jQuery}
		 */
		this._playing = null;

		/**
		 * All event handlers.
		 * @todo The cloned content removale is too late
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this._core.register({ type: 'state', name: 'playing', tags: [ 'interacting' ] });
				}
			}, this),
			'resize.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.video && this.isInFullScreen()) {
					e.preventDefault();
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.is('resizing')) {
					this._core.$stage.find('.cloned .owl-video-frame').remove();
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position' && this._playing) {
					this.stop();
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (!e.namespace) {
					return;
				}

				var $element = $(e.content).find('.owl-video');

				if ($element.length) {
					$element.css('display', 'none');
					this.fetch($element, $(e.content));
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Video.Defaults, this._core.options);

		// register event handlers
		this._core.$element.on(this._handlers);

		this._core.$element.on('click.owl.video', '.owl-video-play-icon', $.proxy(function(e) {
			this.play(e);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Video.Defaults = {
		video: false,
		videoHeight: false,
		videoWidth: false
	};

	/**
	 * Gets the video ID and the type (YouTube/Vimeo/vzaar only).
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {jQuery} item - The item containing the video.
	 */
	Video.prototype.fetch = function(target, item) {
			var type = (function() {
					if (target.attr('data-vimeo-id')) {
						return 'vimeo';
					} else if (target.attr('data-vzaar-id')) {
						return 'vzaar'
					} else {
						return 'youtube';
					}
				})(),
				id = target.attr('data-vimeo-id') || target.attr('data-youtube-id') || target.attr('data-vzaar-id'),
				width = target.attr('data-width') || this._core.settings.videoWidth,
				height = target.attr('data-height') || this._core.settings.videoHeight,
				url = target.attr('href');

		if (url) {

			/*
					Parses the id's out of the following urls (and probably more):
					https://www.youtube.com/watch?v=:id
					https://youtu.be/:id
					https://vimeo.com/:id
					https://vimeo.com/channels/:channel/:id
					https://vimeo.com/groups/:group/videos/:id
					https://app.vzaar.com/videos/:id

					Visual example: https://regexper.com/#(http%3A%7Chttps%3A%7C)%5C%2F%5C%2F(player.%7Cwww.%7Capp.)%3F(vimeo%5C.com%7Cyoutu(be%5C.com%7C%5C.be%7Cbe%5C.googleapis%5C.com)%7Cvzaar%5C.com)%5C%2F(video%5C%2F%7Cvideos%5C%2F%7Cembed%5C%2F%7Cchannels%5C%2F.%2B%5C%2F%7Cgroups%5C%2F.%2B%5C%2F%7Cwatch%5C%3Fv%3D%7Cv%5C%2F)%3F(%5BA-Za-z0-9._%25-%5D*)(%5C%26%5CS%2B)%3F
			*/

			id = url.match(/(http:|https:|)\/\/(player.|www.|app.)?(vimeo\.com|youtu(be\.com|\.be|be\.googleapis\.com|be\-nocookie\.com)|vzaar\.com)\/(video\/|videos\/|embed\/|channels\/.+\/|groups\/.+\/|watch\?v=|v\/)?([A-Za-z0-9._%-]*)(\&\S+)?/);

			if (id[3].indexOf('youtu') > -1) {
				type = 'youtube';
			} else if (id[3].indexOf('vimeo') > -1) {
				type = 'vimeo';
			} else if (id[3].indexOf('vzaar') > -1) {
				type = 'vzaar';
			} else {
				throw new Error('Video URL not supported.');
			}
			id = id[6];
		} else {
			throw new Error('Missing video URL.');
		}

		this._videos[url] = {
			type: type,
			id: id,
			width: width,
			height: height
		};

		item.attr('data-video', url);

		this.thumbnail(target, this._videos[url]);
	};

	/**
	 * Creates video thumbnail.
	 * @protected
	 * @param {jQuery} target - The target containing the video data.
	 * @param {Object} info - The video info object.
	 * @see `fetch`
	 */
	Video.prototype.thumbnail = function(target, video) {
		var tnLink,
			icon,
			path,
			dimensions = video.width && video.height ? 'width:' + video.width + 'px;height:' + video.height + 'px;' : '',
			customTn = target.find('img'),
			srcType = 'src',
			lazyClass = '',
			settings = this._core.settings,
			create = function(path) {
				icon = '<div class="owl-video-play-icon"></div>';

				if (settings.lazyLoad) {
					tnLink = $('<div/>',{
						"class": 'owl-video-tn ' + lazyClass,
						"srcType": path
					});
				} else {
					tnLink = $( '<div/>', {
						"class": "owl-video-tn",
						"style": 'opacity:1;background-image:url(' + path + ')'
					});
				}
				target.after(tnLink);
				target.after(icon);
			};

		// wrap video content into owl-video-wrapper div
		target.wrap( $( '<div/>', {
			"class": "owl-video-wrapper",
			"style": dimensions
		}));

		if (this._core.settings.lazyLoad) {
			srcType = 'data-src';
			lazyClass = 'owl-lazy';
		}

		// custom thumbnail
		if (customTn.length) {
			create(customTn.attr(srcType));
			customTn.remove();
			return false;
		}

		if (video.type === 'youtube') {
			path = "//img.youtube.com/vi/" + video.id + "/hqdefault.jpg";
			create(path);
		} else if (video.type === 'vimeo') {
			$.ajax({
				type: 'GET',
				url: '//vimeo.com/api/v2/video/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data[0].thumbnail_large;
					create(path);
				}
			});
		} else if (video.type === 'vzaar') {
			$.ajax({
				type: 'GET',
				url: '//vzaar.com/api/videos/' + video.id + '.json',
				jsonp: 'callback',
				dataType: 'jsonp',
				success: function(data) {
					path = data.framegrab_url;
					create(path);
				}
			});
		}
	};

	/**
	 * Stops the current video.
	 * @public
	 */
	Video.prototype.stop = function() {
		this._core.trigger('stop', null, 'video');
		this._playing.find('.owl-video-frame').remove();
		this._playing.removeClass('owl-video-playing');
		this._playing = null;
		this._core.leave('playing');
		this._core.trigger('stopped', null, 'video');
	};

	/**
	 * Starts the current video.
	 * @public
	 * @param {Event} event - The event arguments.
	 */
	Video.prototype.play = function(event) {
		var target = $(event.target),
			item = target.closest('.' + this._core.settings.itemClass),
			video = this._videos[item.attr('data-video')],
			width = video.width || '100%',
			height = video.height || this._core.$stage.height(),
			html,
			iframe;

		if (this._playing) {
			return;
		}

		this._core.enter('playing');
		this._core.trigger('play', null, 'video');

		item = this._core.items(this._core.relative(item.index()));

		this._core.reset(item.index());

		html = $( '<iframe frameborder="0" allowfullscreen mozallowfullscreen webkitAllowFullScreen ></iframe>' );
		html.attr( 'height', height );
		html.attr( 'width', width );
		if (video.type === 'youtube') {
			html.attr( 'src', '//www.youtube.com/embed/' + video.id + '?autoplay=1&rel=0&v=' + video.id );
		} else if (video.type === 'vimeo') {
			html.attr( 'src', '//player.vimeo.com/video/' + video.id + '?autoplay=1' );
		} else if (video.type === 'vzaar') {
			html.attr( 'src', '//view.vzaar.com/' + video.id + '/player?autoplay=true' );
		}

		iframe = $(html).wrap( '<div class="owl-video-frame" />' ).insertAfter(item.find('.owl-video'));

		this._playing = item.addClass('owl-video-playing');
	};

	/**
	 * Checks whether an video is currently in full screen mode or not.
	 * @todo Bad style because looks like a readonly method but changes members.
	 * @protected
	 * @returns {Boolean}
	 */
	Video.prototype.isInFullScreen = function() {
		var element = document.fullscreenElement || document.mozFullScreenElement ||
				document.webkitFullscreenElement;

		return element && $(element).parent().hasClass('owl-video-frame');
	};

	/**
	 * Destroys the plugin.
	 */
	Video.prototype.destroy = function() {
		var handler, property;

		this._core.$element.off('click.owl.video');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Video = Video;

})(window.Zepto || window.jQuery, window, document);

/**
 * Animate Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the animate plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Animate = function(scope) {
		this.core = scope;
		this.core.options = $.extend({}, Animate.Defaults, this.core.options);
		this.swapping = true;
		this.previous = undefined;
		this.next = undefined;

		this.handlers = {
			'change.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.previous = this.core.current();
					this.next = e.property.value;
				}
			}, this),
			'drag.owl.carousel dragged.owl.carousel translated.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					this.swapping = e.type == 'translated';
				}
			}, this),
			'translate.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this.swapping && (this.core.options.animateOut || this.core.options.animateIn)) {
					this.swap();
				}
			}, this)
		};

		this.core.$element.on(this.handlers);
	};

	/**
	 * Default options.
	 * @public
	 */
	Animate.Defaults = {
		animateOut: false,
		animateIn: false
	};

	/**
	 * Toggles the animation classes whenever an translations starts.
	 * @protected
	 * @returns {Boolean|undefined}
	 */
	Animate.prototype.swap = function() {

		if (this.core.settings.items !== 1) {
			return;
		}

		if (!$.support.animation || !$.support.transition) {
			return;
		}

		this.core.speed(0);

		var left,
			clear = $.proxy(this.clear, this),
			previous = this.core.$stage.children().eq(this.previous),
			next = this.core.$stage.children().eq(this.next),
			incoming = this.core.settings.animateIn,
			outgoing = this.core.settings.animateOut;

		if (this.core.current() === this.previous) {
			return;
		}

		if (outgoing) {
			left = this.core.coordinates(this.previous) - this.core.coordinates(this.next);
			previous.one($.support.animation.end, clear)
				.css( { 'left': left + 'px' } )
				.addClass('animated owl-animated-out')
				.addClass(outgoing);
		}

		if (incoming) {
			next.one($.support.animation.end, clear)
				.addClass('animated owl-animated-in')
				.addClass(incoming);
		}
	};

	Animate.prototype.clear = function(e) {
		$(e.target).css( { 'left': '' } )
			.removeClass('animated owl-animated-out owl-animated-in')
			.removeClass(this.core.settings.animateIn)
			.removeClass(this.core.settings.animateOut);
		this.core.onTransitionEnd();
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Animate.prototype.destroy = function() {
		var handler, property;

		for (handler in this.handlers) {
			this.core.$element.off(handler, this.handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Animate = Animate;

})(window.Zepto || window.jQuery, window, document);

/**
 * Autoplay Plugin
 * @version 2.3.4
 * @author Bartosz Wojciechowski
 * @author Artus Kolanowski
 * @author David Deutsch
 * @author Tom De Caluwé
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	/**
	 * Creates the autoplay plugin.
	 * @class The Autoplay Plugin
	 * @param {Owl} scope - The Owl Carousel
	 */
	var Autoplay = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * The autoplay timeout id.
		 * @type {Number}
		 */
		this._call = null;

		/**
		 * Depending on the state of the plugin, this variable contains either
		 * the start time of the timer or the current timer value if it's
		 * paused. Since we start in a paused state we initialize the timer
		 * value.
		 * @type {Number}
		 */
		this._time = 0;

		/**
		 * Stores the timeout currently used.
		 * @type {Number}
		 */
		this._timeout = 0;

		/**
		 * Indicates whenever the autoplay is paused.
		 * @type {Boolean}
		 */
		this._paused = true;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'settings') {
					if (this._core.settings.autoplay) {
						this.play();
					} else {
						this.stop();
					}
				} else if (e.namespace && e.property.name === 'position' && this._paused) {
					// Reset the timer. This code is triggered when the position
					// of the carousel was changed through user interaction.
					this._time = 0;
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.autoplay) {
					this.play();
				}
			}, this),
			'play.owl.autoplay': $.proxy(function(e, t, s) {
				if (e.namespace) {
					this.play(t, s);
				}
			}, this),
			'stop.owl.autoplay': $.proxy(function(e) {
				if (e.namespace) {
					this.stop();
				}
			}, this),
			'mouseover.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'mouseleave.owl.autoplay': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.play();
				}
			}, this),
			'touchstart.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause && this._core.is('rotating')) {
					this.pause();
				}
			}, this),
			'touchend.owl.core': $.proxy(function() {
				if (this._core.settings.autoplayHoverPause) {
					this.play();
				}
			}, this)
		};

		// register event handlers
		this._core.$element.on(this._handlers);

		// set default options
		this._core.options = $.extend({}, Autoplay.Defaults, this._core.options);
	};

	/**
	 * Default options.
	 * @public
	 */
	Autoplay.Defaults = {
		autoplay: false,
		autoplayTimeout: 5000,
		autoplayHoverPause: false,
		autoplaySpeed: false
	};

	/**
	 * Transition to the next slide and set a timeout for the next transition.
	 * @private
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype._next = function(speed) {
		this._call = window.setTimeout(
			$.proxy(this._next, this, speed),
			this._timeout * (Math.round(this.read() / this._timeout) + 1) - this.read()
		);

		if (this._core.is('interacting') || document.hidden) {
			return;
		}
		this._core.next(speed || this._core.settings.autoplaySpeed);
	}

	/**
	 * Reads the current timer value when the timer is playing.
	 * @public
	 */
	Autoplay.prototype.read = function() {
		return new Date().getTime() - this._time;
	};

	/**
	 * Starts the autoplay.
	 * @public
	 * @param {Number} [timeout] - The interval before the next animation starts.
	 * @param {Number} [speed] - The animation speed for the animations.
	 */
	Autoplay.prototype.play = function(timeout, speed) {
		var elapsed;

		if (!this._core.is('rotating')) {
			this._core.enter('rotating');
		}

		timeout = timeout || this._core.settings.autoplayTimeout;

		// Calculate the elapsed time since the last transition. If the carousel
		// wasn't playing this calculation will yield zero.
		elapsed = Math.min(this._time % (this._timeout || timeout), timeout);

		if (this._paused) {
			// Start the clock.
			this._time = this.read();
			this._paused = false;
		} else {
			// Clear the active timeout to allow replacement.
			window.clearTimeout(this._call);
		}

		// Adjust the origin of the timer to match the new timeout value.
		this._time += this.read() % timeout - elapsed;

		this._timeout = timeout;
		this._call = window.setTimeout($.proxy(this._next, this, speed), timeout - elapsed);
	};

	/**
	 * Stops the autoplay.
	 * @public
	 */
	Autoplay.prototype.stop = function() {
		if (this._core.is('rotating')) {
			// Reset the clock.
			this._time = 0;
			this._paused = true;

			window.clearTimeout(this._call);
			this._core.leave('rotating');
		}
	};

	/**
	 * Pauses the autoplay.
	 * @public
	 */
	Autoplay.prototype.pause = function() {
		if (this._core.is('rotating') && !this._paused) {
			// Pause the clock.
			this._time = this.read();
			this._paused = true;

			window.clearTimeout(this._call);
		}
	};

	/**
	 * Destroys the plugin.
	 */
	Autoplay.prototype.destroy = function() {
		var handler, property;

		this.stop();

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.autoplay = Autoplay;

})(window.Zepto || window.jQuery, window, document);

/**
 * Navigation Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the navigation plugin.
	 * @class The Navigation Plugin
	 * @param {Owl} carousel - The Owl Carousel.
	 */
	var Navigation = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Indicates whether the plugin is initialized or not.
		 * @protected
		 * @type {Boolean}
		 */
		this._initialized = false;

		/**
		 * The current paging indexes.
		 * @protected
		 * @type {Array}
		 */
		this._pages = [];

		/**
		 * All DOM elements of the user interface.
		 * @protected
		 * @type {Object}
		 */
		this._controls = {};

		/**
		 * Markup for an indicator.
		 * @protected
		 * @type {Array.<String>}
		 */
		this._templates = [];

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * Overridden methods of the carousel.
		 * @protected
		 * @type {Object}
		 */
		this._overrides = {
			next: this._core.next,
			prev: this._core.prev,
			to: this._core.to
		};

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.push('<div class="' + this._core.settings.dotClass + '">' +
						$(e.content).find('[data-dot]').addBack('[data-dot]').attr('data-dot') + '</div>');
				}
			}, this),
			'added.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 0, this._templates.pop());
				}
			}, this),
			'remove.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.dotsData) {
					this._templates.splice(e.position, 1);
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name == 'position') {
					this.draw();
				}
			}, this),
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && !this._initialized) {
					this._core.trigger('initialize', null, 'navigation');
					this.initialize();
					this.update();
					this.draw();
					this._initialized = true;
					this._core.trigger('initialized', null, 'navigation');
				}
			}, this),
			'refreshed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._initialized) {
					this._core.trigger('refresh', null, 'navigation');
					this.update();
					this.draw();
					this._core.trigger('refreshed', null, 'navigation');
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Navigation.Defaults, this._core.options);

		// register event handlers
		this.$element.on(this._handlers);
	};

	/**
	 * Default options.
	 * @public
	 * @todo Rename `slideBy` to `navBy`
	 */
	Navigation.Defaults = {
		nav: false,
		navText: [
			'<span aria-label="' + 'Previous' + '">&#x2039;</span>',
			'<span aria-label="' + 'Next' + '">&#x203a;</span>'
		],
		navSpeed: false,
		navElement: 'button type="button" role="presentation"',
		navContainer: false,
		navContainerClass: 'owl-nav',
		navClass: [
			'owl-prev',
			'owl-next'
		],
		slideBy: 1,
		dotClass: 'owl-dot',
		dotsClass: 'owl-dots',
		dots: true,
		dotsEach: false,
		dotsData: false,
		dotsSpeed: false,
		dotsContainer: false
	};

	/**
	 * Initializes the layout of the plugin and extends the carousel.
	 * @protected
	 */
	Navigation.prototype.initialize = function() {
		var override,
			settings = this._core.settings;

		// create DOM structure for relative navigation
		this._controls.$relative = (settings.navContainer ? $(settings.navContainer)
			: $('<div>').addClass(settings.navContainerClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$previous = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[0])
			.html(settings.navText[0])
			.prependTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.prev(settings.navSpeed);
			}, this));
		this._controls.$next = $('<' + settings.navElement + '>')
			.addClass(settings.navClass[1])
			.html(settings.navText[1])
			.appendTo(this._controls.$relative)
			.on('click', $.proxy(function(e) {
				this.next(settings.navSpeed);
			}, this));

		// create DOM structure for absolute navigation
		if (!settings.dotsData) {
			this._templates = [ $('<button role="button">')
				.addClass(settings.dotClass)
				.append($('<span>'))
				.prop('outerHTML') ];
		}

		this._controls.$absolute = (settings.dotsContainer ? $(settings.dotsContainer)
			: $('<div>').addClass(settings.dotsClass).appendTo(this.$element)).addClass('disabled');

		this._controls.$absolute.on('click', 'button', $.proxy(function(e) {
			var index = $(e.target).parent().is(this._controls.$absolute)
				? $(e.target).index() : $(e.target).parent().index();

			e.preventDefault();

			this.to(index, settings.dotsSpeed);
		}, this));

		/*$el.on('focusin', function() {
			$(document).off(".carousel");

			$(document).on('keydown.carousel', function(e) {
				if(e.keyCode == 37) {
					$el.trigger('prev.owl')
				}
				if(e.keyCode == 39) {
					$el.trigger('next.owl')
				}
			});
		});*/

		// override public methods of the carousel
		for (override in this._overrides) {
			this._core[override] = $.proxy(this[override], this);
		}
	};

	/**
	 * Destroys the plugin.
	 * @protected
	 */
	Navigation.prototype.destroy = function() {
		var handler, control, property, override, settings;
		settings = this._core.settings;

		for (handler in this._handlers) {
			this.$element.off(handler, this._handlers[handler]);
		}
		for (control in this._controls) {
			if (control === '$relative' && settings.navContainer) {
				this._controls[control].html('');
			} else {
				this._controls[control].remove();
			}
		}
		for (override in this.overides) {
			this._core[override] = this._overrides[override];
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	/**
	 * Updates the internal state.
	 * @protected
	 */
	Navigation.prototype.update = function() {
		var i, j, k,
			lower = this._core.clones().length / 2,
			upper = lower + this._core.items().length,
			maximum = this._core.maximum(true),
			settings = this._core.settings,
			size = settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items;

		if (settings.slideBy !== 'page') {
			settings.slideBy = Math.min(settings.slideBy, settings.items);
		}

		if (settings.dots || settings.slideBy == 'page') {
			this._pages = [];

			for (i = lower, j = 0, k = 0; i < upper; i++) {
				if (j >= size || j === 0) {
					this._pages.push({
						start: Math.min(maximum, i - lower),
						end: i - lower + size - 1
					});
					if (Math.min(maximum, i - lower) === maximum) {
						break;
					}
					j = 0, ++k;
				}
				j += this._core.mergers(this._core.relative(i));
			}
		}
	};

	/**
	 * Draws the user interface.
	 * @todo The option `dotsData` wont work.
	 * @protected
	 */
	Navigation.prototype.draw = function() {
		var difference,
			settings = this._core.settings,
			disabled = this._core.items().length <= settings.items,
			index = this._core.relative(this._core.current()),
			loop = settings.loop || settings.rewind;

		this._controls.$relative.toggleClass('disabled', !settings.nav || disabled);

		if (settings.nav) {
			this._controls.$previous.toggleClass('disabled', !loop && index <= this._core.minimum(true));
			this._controls.$next.toggleClass('disabled', !loop && index >= this._core.maximum(true));
		}

		this._controls.$absolute.toggleClass('disabled', !settings.dots || disabled);

		if (settings.dots) {
			difference = this._pages.length - this._controls.$absolute.children().length;

			if (settings.dotsData && difference !== 0) {
				this._controls.$absolute.html(this._templates.join(''));
			} else if (difference > 0) {
				this._controls.$absolute.append(new Array(difference + 1).join(this._templates[0]));
			} else if (difference < 0) {
				this._controls.$absolute.children().slice(difference).remove();
			}

			this._controls.$absolute.find('.active').removeClass('active');
			this._controls.$absolute.children().eq($.inArray(this.current(), this._pages)).addClass('active');
		}
	};

	/**
	 * Extends event data.
	 * @protected
	 * @param {Event} event - The event object which gets thrown.
	 */
	Navigation.prototype.onTrigger = function(event) {
		var settings = this._core.settings;

		event.page = {
			index: $.inArray(this.current(), this._pages),
			count: this._pages.length,
			size: settings && (settings.center || settings.autoWidth || settings.dotsData
				? 1 : settings.dotsEach || settings.items)
		};
	};

	/**
	 * Gets the current page position of the carousel.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.current = function() {
		var current = this._core.relative(this._core.current());
		return $.grep(this._pages, $.proxy(function(page, index) {
			return page.start <= current && page.end >= current;
		}, this)).pop();
	};

	/**
	 * Gets the current succesor/predecessor position.
	 * @protected
	 * @returns {Number}
	 */
	Navigation.prototype.getPosition = function(successor) {
		var position, length,
			settings = this._core.settings;

		if (settings.slideBy == 'page') {
			position = $.inArray(this.current(), this._pages);
			length = this._pages.length;
			successor ? ++position : --position;
			position = this._pages[((position % length) + length) % length].start;
		} else {
			position = this._core.relative(this._core.current());
			length = this._core.items().length;
			successor ? position += settings.slideBy : position -= settings.slideBy;
		}

		return position;
	};

	/**
	 * Slides to the next item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.next = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(true), speed);
	};

	/**
	 * Slides to the previous item or page.
	 * @public
	 * @param {Number} [speed=false] - The time in milliseconds for the transition.
	 */
	Navigation.prototype.prev = function(speed) {
		$.proxy(this._overrides.to, this._core)(this.getPosition(false), speed);
	};

	/**
	 * Slides to the specified item or page.
	 * @public
	 * @param {Number} position - The position of the item or page.
	 * @param {Number} [speed] - The time in milliseconds for the transition.
	 * @param {Boolean} [standard=false] - Whether to use the standard behaviour or not.
	 */
	Navigation.prototype.to = function(position, speed, standard) {
		var length;

		if (!standard && this._pages.length) {
			length = this._pages.length;
			$.proxy(this._overrides.to, this._core)(this._pages[((position % length) + length) % length].start, speed);
		} else {
			$.proxy(this._overrides.to, this._core)(position, speed);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Navigation = Navigation;

})(window.Zepto || window.jQuery, window, document);

/**
 * Hash Plugin
 * @version 2.3.4
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {
	'use strict';

	/**
	 * Creates the hash plugin.
	 * @class The Hash Plugin
	 * @param {Owl} carousel - The Owl Carousel
	 */
	var Hash = function(carousel) {
		/**
		 * Reference to the core.
		 * @protected
		 * @type {Owl}
		 */
		this._core = carousel;

		/**
		 * Hash index for the items.
		 * @protected
		 * @type {Object}
		 */
		this._hashes = {};

		/**
		 * The carousel element.
		 * @type {jQuery}
		 */
		this.$element = this._core.$element;

		/**
		 * All event handlers.
		 * @protected
		 * @type {Object}
		 */
		this._handlers = {
			'initialized.owl.carousel': $.proxy(function(e) {
				if (e.namespace && this._core.settings.startPosition === 'URLHash') {
					$(window).trigger('hashchange.owl.navigation');
				}
			}, this),
			'prepared.owl.carousel': $.proxy(function(e) {
				if (e.namespace) {
					var hash = $(e.content).find('[data-hash]').addBack('[data-hash]').attr('data-hash');

					if (!hash) {
						return;
					}

					this._hashes[hash] = e.content;
				}
			}, this),
			'changed.owl.carousel': $.proxy(function(e) {
				if (e.namespace && e.property.name === 'position') {
					var current = this._core.items(this._core.relative(this._core.current())),
						hash = $.map(this._hashes, function(item, hash) {
							return item === current ? hash : null;
						}).join();

					if (!hash || window.location.hash.slice(1) === hash) {
						return;
					}

					window.location.hash = hash;
				}
			}, this)
		};

		// set default options
		this._core.options = $.extend({}, Hash.Defaults, this._core.options);

		// register the event handlers
		this.$element.on(this._handlers);

		// register event listener for hash navigation
		$(window).on('hashchange.owl.navigation', $.proxy(function(e) {
			var hash = window.location.hash.substring(1),
				items = this._core.$stage.children(),
				position = this._hashes[hash] && items.index(this._hashes[hash]);

			if (position === undefined || position === this._core.current()) {
				return;
			}

			this._core.to(this._core.relative(position), false, true);
		}, this));
	};

	/**
	 * Default options.
	 * @public
	 */
	Hash.Defaults = {
		URLhashListener: false
	};

	/**
	 * Destroys the plugin.
	 * @public
	 */
	Hash.prototype.destroy = function() {
		var handler, property;

		$(window).off('hashchange.owl.navigation');

		for (handler in this._handlers) {
			this._core.$element.off(handler, this._handlers[handler]);
		}
		for (property in Object.getOwnPropertyNames(this)) {
			typeof this[property] != 'function' && (this[property] = null);
		}
	};

	$.fn.owlCarousel.Constructor.Plugins.Hash = Hash;

})(window.Zepto || window.jQuery, window, document);

/**
 * Support Plugin
 *
 * @version 2.3.4
 * @author Vivid Planet Software GmbH
 * @author Artus Kolanowski
 * @author David Deutsch
 * @license The MIT License (MIT)
 */
;(function($, window, document, undefined) {

	var style = $('<support>').get(0).style,
		prefixes = 'Webkit Moz O ms'.split(' '),
		events = {
			transition: {
				end: {
					WebkitTransition: 'webkitTransitionEnd',
					MozTransition: 'transitionend',
					OTransition: 'oTransitionEnd',
					transition: 'transitionend'
				}
			},
			animation: {
				end: {
					WebkitAnimation: 'webkitAnimationEnd',
					MozAnimation: 'animationend',
					OAnimation: 'oAnimationEnd',
					animation: 'animationend'
				}
			}
		},
		tests = {
			csstransforms: function() {
				return !!test('transform');
			},
			csstransforms3d: function() {
				return !!test('perspective');
			},
			csstransitions: function() {
				return !!test('transition');
			},
			cssanimations: function() {
				return !!test('animation');
			}
		};

	function test(property, prefixed) {
		var result = false,
			upper = property.charAt(0).toUpperCase() + property.slice(1);

		$.each((property + ' ' + prefixes.join(upper + ' ') + upper).split(' '), function(i, property) {
			if (style[property] !== undefined) {
				result = prefixed ? property : true;
				return false;
			}
		});

		return result;
	}

	function prefixed(property) {
		return test(property, true);
	}

	if (tests.csstransitions()) {
		/* jshint -W053 */
		$.support.transition = new String(prefixed('transition'))
		$.support.transition.end = events.transition.end[ $.support.transition ];
	}

	if (tests.cssanimations()) {
		/* jshint -W053 */
		$.support.animation = new String(prefixed('animation'))
		$.support.animation.end = events.animation.end[ $.support.animation ];
	}

	if (tests.csstransforms()) {
		/* jshint -W053 */
		$.support.transform = new String(prefixed('transform'));
		$.support.transform3d = tests.csstransforms3d();
	}

})(window.Zepto || window.jQuery, window, document);

},{}],2:[function(require,module,exports){
"use strict";

var _NavBarFixed = _interopRequireDefault(require("./component/NavBarFixed"));

require("./component/carousel");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.addEventListener('load', function () {
  new _NavBarFixed.default(document.querySelector('#navbar')).run();
});

},{"./component/NavBarFixed":3,"./component/carousel":4}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var NavBarFixed =
/*#__PURE__*/
function () {
  function NavBarFixed(element) {
    var _this = this;

    _classCallCheck(this, NavBarFixed);

    this.fixedBlock = function (element) {
      if ($(window).scrollTop() > _this.h) {
        _this.element.classList.add('fixed');
      } else {
        _this.element.classList.remove('fixed');
      }
    };

    this.element = element;
    this.h = element.clientHeight;
  }

  _createClass(NavBarFixed, [{
    key: "run",
    value: function run() {
      var _this2 = this;

      $(window).scroll(function () {
        _this2.fixedBlock(_this2.element);
      });
    }
  }]);

  return NavBarFixed;
}();

exports.default = NavBarFixed;

},{}],4:[function(require,module,exports){
"use strict";

require("owl.carousel");

var callbacks = function callbacks(event) {// console.log(event)
};

var options = {
  loop: true,
  items: 1,
  nav: true,
  dots: false,
  lazyLoad: true
};
$(document).ready(function () {
  var owl = $('.owl-carousel');
  owl.owlCarousel(options);
  owl.on('changed.owl.carousel', callbacks);
});

},{"owl.carousel":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvb3dsLmNhcm91c2VsL2Rpc3Qvb3dsLmNhcm91c2VsLmpzIiwic3JjL2pzL2FwcC5qcyIsInNyYy9qcy9jb21wb25lbnQvTmF2QmFyRml4ZWQuanMiLCJzcmMvanMvY29tcG9uZW50L2Nhcm91c2VsLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3gzR0E7O0FBUUE7Ozs7QUFOQSxNQUFNLENBQUMsZ0JBQVAsQ0FBd0IsTUFBeEIsRUFBZ0MsWUFBTTtBQUNsQyxNQUFJLG9CQUFKLENBQWdCLFFBQVEsQ0FBQyxhQUFULENBQXVCLFNBQXZCLENBQWhCLEVBQW1ELEdBQW5EO0FBQ0gsQ0FGRDs7Ozs7Ozs7Ozs7Ozs7OztJQ0ZxQixXOzs7QUFFakIsdUJBQVksT0FBWixFQUFxQjtBQUFBOztBQUFBOztBQUFBLFNBS3JCLFVBTHFCLEdBS1IsVUFBQSxPQUFPLEVBQUk7QUFDcEIsVUFBRyxDQUFDLENBQUMsTUFBRCxDQUFELENBQVUsU0FBVixLQUF3QixLQUFJLENBQUMsQ0FBaEMsRUFBa0M7QUFDOUIsUUFBQSxLQUFJLENBQUMsT0FBTCxDQUFhLFNBQWIsQ0FBdUIsR0FBdkIsQ0FBMkIsT0FBM0I7QUFDSCxPQUZELE1BRU87QUFDSCxRQUFBLEtBQUksQ0FBQyxPQUFMLENBQWEsU0FBYixDQUF1QixNQUF2QixDQUE4QixPQUE5QjtBQUNIO0FBQ0osS0FYb0I7O0FBQ2pCLFNBQUssT0FBTCxHQUFlLE9BQWY7QUFDQSxTQUFLLENBQUwsR0FBUyxPQUFPLENBQUMsWUFBakI7QUFDSDs7OzswQkFVSztBQUFBOztBQUNGLE1BQUEsQ0FBQyxDQUFDLE1BQUQsQ0FBRCxDQUFVLE1BQVYsQ0FBaUIsWUFBTTtBQUNuQixRQUFBLE1BQUksQ0FBQyxVQUFMLENBQWdCLE1BQUksQ0FBQyxPQUFyQjtBQUNILE9BRkQ7QUFHSDs7Ozs7Ozs7Ozs7QUNuQkw7O0FBRUEsSUFBTSxTQUFTLEdBQUcsU0FBWixTQUFZLENBQUMsS0FBRCxFQUFVLENBQ3hCO0FBQ0gsQ0FGRDs7QUFJQSxJQUFNLE9BQU8sR0FBRztBQUNaLEVBQUEsSUFBSSxFQUFDLElBRE87QUFFWixFQUFBLEtBQUssRUFBQyxDQUZNO0FBR1osRUFBQSxHQUFHLEVBQUMsSUFIUTtBQUlaLEVBQUEsSUFBSSxFQUFFLEtBSk07QUFLWixFQUFBLFFBQVEsRUFBQztBQUxHLENBQWhCO0FBU0EsQ0FBQyxDQUFDLFFBQUQsQ0FBRCxDQUFZLEtBQVosQ0FBa0IsWUFBVTtBQUN4QixNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsZUFBRCxDQUFiO0FBQ0EsRUFBQSxHQUFHLENBQUMsV0FBSixDQUFnQixPQUFoQjtBQUVBLEVBQUEsR0FBRyxDQUFDLEVBQUosQ0FBTyxzQkFBUCxFQUErQixTQUEvQjtBQUVILENBTkQiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKipcbiAqIE93bCBDYXJvdXNlbCB2Mi4zLjRcbiAqIENvcHlyaWdodCAyMDEzLTIwMTggRGF2aWQgRGV1dHNjaFxuICogTGljZW5zZWQgdW5kZXI6IFNFRSBMSUNFTlNFIElOIGh0dHBzOi8vZ2l0aHViLmNvbS9Pd2xDYXJvdXNlbDIvT3dsQ2Fyb3VzZWwyL2Jsb2IvbWFzdGVyL0xJQ0VOU0VcbiAqL1xuLyoqXG4gKiBPd2wgY2Fyb3VzZWxcbiAqIEB2ZXJzaW9uIDIuMy40XG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqIEB0b2RvIExhenkgTG9hZCBJY29uXG4gKiBAdG9kbyBwcmV2ZW50IGFuaW1hdGlvbmVuZCBidWJsaW5nXG4gKiBAdG9kbyBpdGVtc1NjYWxlVXBcbiAqIEB0b2RvIFRlc3QgWmVwdG9cbiAqIEB0b2RvIHN0YWdlUGFkZGluZyBjYWxjdWxhdGUgd3JvbmcgYWN0aXZlIGNsYXNzZXNcbiAqL1xuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIGNhcm91c2VsLlxuXHQgKiBAY2xhc3MgVGhlIE93bCBDYXJvdXNlbC5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeX0gZWxlbWVudCAtIFRoZSBlbGVtZW50IHRvIGNyZWF0ZSB0aGUgY2Fyb3VzZWwgZm9yLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gVGhlIG9wdGlvbnNcblx0ICovXG5cdGZ1bmN0aW9uIE93bChlbGVtZW50LCBvcHRpb25zKSB7XG5cblx0XHQvKipcblx0XHQgKiBDdXJyZW50IHNldHRpbmdzIGZvciB0aGUgY2Fyb3VzZWwuXG5cdFx0ICogQHB1YmxpY1xuXHRcdCAqL1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogQ3VycmVudCBvcHRpb25zIHNldCBieSB0aGUgY2FsbGVyIGluY2x1ZGluZyBkZWZhdWx0cy5cblx0XHQgKiBAcHVibGljXG5cdFx0ICovXG5cdFx0dGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIE93bC5EZWZhdWx0cywgb3B0aW9ucyk7XG5cblx0XHQvKipcblx0XHQgKiBQbHVnaW4gZWxlbWVudC5cblx0XHQgKiBAcHVibGljXG5cdFx0ICovXG5cdFx0dGhpcy4kZWxlbWVudCA9ICQoZWxlbWVudCk7XG5cblx0XHQvKipcblx0XHQgKiBQcm94aWVkIGV2ZW50IGhhbmRsZXJzLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKi9cblx0XHR0aGlzLl9oYW5kbGVycyA9IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogUmVmZXJlbmNlcyB0byB0aGUgcnVubmluZyBwbHVnaW5zIG9mIHRoaXMgY2Fyb3VzZWwuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX3BsdWdpbnMgPSB7fTtcblxuXHRcdC8qKlxuXHRcdCAqIEN1cnJlbnRseSBzdXBwcmVzc2VkIGV2ZW50cyB0byBwcmV2ZW50IHRoZW0gZnJvbSBiZWluZyByZXRyaWdnZXJlZC5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICovXG5cdFx0dGhpcy5fc3VwcmVzcyA9IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogQWJzb2x1dGUgY3VycmVudCBwb3NpdGlvbi5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICovXG5cdFx0dGhpcy5fY3VycmVudCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBBbmltYXRpb24gc3BlZWQgaW4gbWlsbGlzZWNvbmRzLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKi9cblx0XHR0aGlzLl9zcGVlZCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBDb29yZGluYXRlcyBvZiBhbGwgaXRlbXMgaW4gcGl4ZWwuXG5cdFx0ICogQHRvZG8gVGhlIG5hbWUgb2YgdGhpcyBtZW1iZXIgaXMgbWlzc2xlYWRpbmcuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX2Nvb3JkaW5hdGVzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBDdXJyZW50IGJyZWFrcG9pbnQuXG5cdFx0ICogQHRvZG8gUmVhbCBtZWRpYSBxdWVyaWVzIHdvdWxkIGJlIG5pY2UuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX2JyZWFrcG9pbnQgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogQ3VycmVudCB3aWR0aCBvZiB0aGUgcGx1Z2luIGVsZW1lbnQuXG5cdFx0ICovXG5cdFx0dGhpcy5fd2lkdGggPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogQWxsIHJlYWwgaXRlbXMuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX2l0ZW1zID0gW107XG5cblx0XHQvKipcblx0XHQgKiBBbGwgY2xvbmVkIGl0ZW1zLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKi9cblx0XHR0aGlzLl9jbG9uZXMgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIE1lcmdlIHZhbHVlcyBvZiBhbGwgaXRlbXMuXG5cdFx0ICogQHRvZG8gTWF5YmUgdGhpcyBjb3VsZCBiZSBwYXJ0IG9mIGEgcGx1Z2luLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKi9cblx0XHR0aGlzLl9tZXJnZXJzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBXaWR0aHMgb2YgYWxsIGl0ZW1zLlxuXHRcdCAqL1xuXHRcdHRoaXMuX3dpZHRocyA9IFtdO1xuXG5cdFx0LyoqXG5cdFx0ICogSW52YWxpZGF0ZWQgcGFydHMgd2l0aGluIHRoZSB1cGRhdGUgcHJvY2Vzcy5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICovXG5cdFx0dGhpcy5faW52YWxpZGF0ZWQgPSB7fTtcblxuXHRcdC8qKlxuXHRcdCAqIE9yZGVyZWQgbGlzdCBvZiB3b3JrZXJzIGZvciB0aGUgdXBkYXRlIHByb2Nlc3MuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX3BpcGUgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIEN1cnJlbnQgc3RhdGUgaW5mb3JtYXRpb24gZm9yIHRoZSBkcmFnIG9wZXJhdGlvbi5cblx0XHQgKiBAdG9kbyAjMjYxXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqL1xuXHRcdHRoaXMuX2RyYWcgPSB7XG5cdFx0XHR0aW1lOiBudWxsLFxuXHRcdFx0dGFyZ2V0OiBudWxsLFxuXHRcdFx0cG9pbnRlcjogbnVsbCxcblx0XHRcdHN0YWdlOiB7XG5cdFx0XHRcdHN0YXJ0OiBudWxsLFxuXHRcdFx0XHRjdXJyZW50OiBudWxsXG5cdFx0XHR9LFxuXHRcdFx0ZGlyZWN0aW9uOiBudWxsXG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEN1cnJlbnQgc3RhdGUgaW5mb3JtYXRpb24gYW5kIHRoZWlyIHRhZ3MuXG5cdFx0ICogQHR5cGUge09iamVjdH1cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICovXG5cdFx0dGhpcy5fc3RhdGVzID0ge1xuXHRcdFx0Y3VycmVudDoge30sXG5cdFx0XHR0YWdzOiB7XG5cdFx0XHRcdCdpbml0aWFsaXppbmcnOiBbICdidXN5JyBdLFxuXHRcdFx0XHQnYW5pbWF0aW5nJzogWyAnYnVzeScgXSxcblx0XHRcdFx0J2RyYWdnaW5nJzogWyAnaW50ZXJhY3RpbmcnIF1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0JC5lYWNoKFsgJ29uUmVzaXplJywgJ29uVGhyb3R0bGVkUmVzaXplJyBdLCAkLnByb3h5KGZ1bmN0aW9uKGksIGhhbmRsZXIpIHtcblx0XHRcdHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdID0gJC5wcm94eSh0aGlzW2hhbmRsZXJdLCB0aGlzKTtcblx0XHR9LCB0aGlzKSk7XG5cblx0XHQkLmVhY2goT3dsLlBsdWdpbnMsICQucHJveHkoZnVuY3Rpb24oa2V5LCBwbHVnaW4pIHtcblx0XHRcdHRoaXMuX3BsdWdpbnNba2V5LmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpICsga2V5LnNsaWNlKDEpXVxuXHRcdFx0XHQ9IG5ldyBwbHVnaW4odGhpcyk7XG5cdFx0fSwgdGhpcykpO1xuXG5cdFx0JC5lYWNoKE93bC5Xb3JrZXJzLCAkLnByb3h5KGZ1bmN0aW9uKHByaW9yaXR5LCB3b3JrZXIpIHtcblx0XHRcdHRoaXMuX3BpcGUucHVzaCh7XG5cdFx0XHRcdCdmaWx0ZXInOiB3b3JrZXIuZmlsdGVyLFxuXHRcdFx0XHQncnVuJzogJC5wcm94eSh3b3JrZXIucnVuLCB0aGlzKVxuXHRcdFx0fSk7XG5cdFx0fSwgdGhpcykpO1xuXG5cdFx0dGhpcy5zZXR1cCgpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlZmF1bHQgb3B0aW9ucyBmb3IgdGhlIGNhcm91c2VsLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRPd2wuRGVmYXVsdHMgPSB7XG5cdFx0aXRlbXM6IDMsXG5cdFx0bG9vcDogZmFsc2UsXG5cdFx0Y2VudGVyOiBmYWxzZSxcblx0XHRyZXdpbmQ6IGZhbHNlLFxuXHRcdGNoZWNrVmlzaWJpbGl0eTogdHJ1ZSxcblxuXHRcdG1vdXNlRHJhZzogdHJ1ZSxcblx0XHR0b3VjaERyYWc6IHRydWUsXG5cdFx0cHVsbERyYWc6IHRydWUsXG5cdFx0ZnJlZURyYWc6IGZhbHNlLFxuXG5cdFx0bWFyZ2luOiAwLFxuXHRcdHN0YWdlUGFkZGluZzogMCxcblxuXHRcdG1lcmdlOiBmYWxzZSxcblx0XHRtZXJnZUZpdDogdHJ1ZSxcblx0XHRhdXRvV2lkdGg6IGZhbHNlLFxuXG5cdFx0c3RhcnRQb3NpdGlvbjogMCxcblx0XHRydGw6IGZhbHNlLFxuXG5cdFx0c21hcnRTcGVlZDogMjUwLFxuXHRcdGZsdWlkU3BlZWQ6IGZhbHNlLFxuXHRcdGRyYWdFbmRTcGVlZDogZmFsc2UsXG5cblx0XHRyZXNwb25zaXZlOiB7fSxcblx0XHRyZXNwb25zaXZlUmVmcmVzaFJhdGU6IDIwMCxcblx0XHRyZXNwb25zaXZlQmFzZUVsZW1lbnQ6IHdpbmRvdyxcblxuXHRcdGZhbGxiYWNrRWFzaW5nOiAnc3dpbmcnLFxuXHRcdHNsaWRlVHJhbnNpdGlvbjogJycsXG5cblx0XHRpbmZvOiBmYWxzZSxcblxuXHRcdG5lc3RlZEl0ZW1TZWxlY3RvcjogZmFsc2UsXG5cdFx0aXRlbUVsZW1lbnQ6ICdkaXYnLFxuXHRcdHN0YWdlRWxlbWVudDogJ2RpdicsXG5cblx0XHRyZWZyZXNoQ2xhc3M6ICdvd2wtcmVmcmVzaCcsXG5cdFx0bG9hZGVkQ2xhc3M6ICdvd2wtbG9hZGVkJyxcblx0XHRsb2FkaW5nQ2xhc3M6ICdvd2wtbG9hZGluZycsXG5cdFx0cnRsQ2xhc3M6ICdvd2wtcnRsJyxcblx0XHRyZXNwb25zaXZlQ2xhc3M6ICdvd2wtcmVzcG9uc2l2ZScsXG5cdFx0ZHJhZ0NsYXNzOiAnb3dsLWRyYWcnLFxuXHRcdGl0ZW1DbGFzczogJ293bC1pdGVtJyxcblx0XHRzdGFnZUNsYXNzOiAnb3dsLXN0YWdlJyxcblx0XHRzdGFnZU91dGVyQ2xhc3M6ICdvd2wtc3RhZ2Utb3V0ZXInLFxuXHRcdGdyYWJDbGFzczogJ293bC1ncmFiJ1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBFbnVtZXJhdGlvbiBmb3Igd2lkdGguXG5cdCAqIEBwdWJsaWNcblx0ICogQHJlYWRvbmx5XG5cdCAqIEBlbnVtIHtTdHJpbmd9XG5cdCAqL1xuXHRPd2wuV2lkdGggPSB7XG5cdFx0RGVmYXVsdDogJ2RlZmF1bHQnLFxuXHRcdElubmVyOiAnaW5uZXInLFxuXHRcdE91dGVyOiAnb3V0ZXInXG5cdH07XG5cblx0LyoqXG5cdCAqIEVudW1lcmF0aW9uIGZvciB0eXBlcy5cblx0ICogQHB1YmxpY1xuXHQgKiBAcmVhZG9ubHlcblx0ICogQGVudW0ge1N0cmluZ31cblx0ICovXG5cdE93bC5UeXBlID0ge1xuXHRcdEV2ZW50OiAnZXZlbnQnLFxuXHRcdFN0YXRlOiAnc3RhdGUnXG5cdH07XG5cblx0LyoqXG5cdCAqIENvbnRhaW5zIGFsbCByZWdpc3RlcmVkIHBsdWdpbnMuXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdE93bC5QbHVnaW5zID0ge307XG5cblx0LyoqXG5cdCAqIExpc3Qgb2Ygd29ya2VycyBpbnZvbHZlZCBpbiB0aGUgdXBkYXRlIHByb2Nlc3MuXG5cdCAqL1xuXHRPd2wuV29ya2VycyA9IFsge1xuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuX3dpZHRoID0gdGhpcy4kZWxlbWVudC53aWR0aCgpO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xuXHRcdFx0Y2FjaGUuY3VycmVudCA9IHRoaXMuX2l0ZW1zICYmIHRoaXMuX2l0ZW1zW3RoaXMucmVsYXRpdmUodGhpcy5fY3VycmVudCldO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuY2xvbmVkJykucmVtb3ZlKCk7XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XG5cdFx0XHR2YXIgbWFyZ2luID0gdGhpcy5zZXR0aW5ncy5tYXJnaW4gfHwgJycsXG5cdFx0XHRcdGdyaWQgPSAhdGhpcy5zZXR0aW5ncy5hdXRvV2lkdGgsXG5cdFx0XHRcdHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsLFxuXHRcdFx0XHRjc3MgPSB7XG5cdFx0XHRcdFx0J3dpZHRoJzogJ2F1dG8nLFxuXHRcdFx0XHRcdCdtYXJnaW4tbGVmdCc6IHJ0bCA/IG1hcmdpbiA6ICcnLFxuXHRcdFx0XHRcdCdtYXJnaW4tcmlnaHQnOiBydGwgPyAnJyA6IG1hcmdpblxuXHRcdFx0XHR9O1xuXG5cdFx0XHQhZ3JpZCAmJiB0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmNzcyhjc3MpO1xuXG5cdFx0XHRjYWNoZS5jc3MgPSBjc3M7XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcblx0XHRydW46IGZ1bmN0aW9uKGNhY2hlKSB7XG5cdFx0XHR2YXIgd2lkdGggPSAodGhpcy53aWR0aCgpIC8gdGhpcy5zZXR0aW5ncy5pdGVtcykudG9GaXhlZCgzKSAtIHRoaXMuc2V0dGluZ3MubWFyZ2luLFxuXHRcdFx0XHRtZXJnZSA9IG51bGwsXG5cdFx0XHRcdGl0ZXJhdG9yID0gdGhpcy5faXRlbXMubGVuZ3RoLFxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxuXHRcdFx0XHR3aWR0aHMgPSBbXTtcblxuXHRcdFx0Y2FjaGUuaXRlbXMgPSB7XG5cdFx0XHRcdG1lcmdlOiBmYWxzZSxcblx0XHRcdFx0d2lkdGg6IHdpZHRoXG5cdFx0XHR9O1xuXG5cdFx0XHR3aGlsZSAoaXRlcmF0b3ItLSkge1xuXHRcdFx0XHRtZXJnZSA9IHRoaXMuX21lcmdlcnNbaXRlcmF0b3JdO1xuXHRcdFx0XHRtZXJnZSA9IHRoaXMuc2V0dGluZ3MubWVyZ2VGaXQgJiYgTWF0aC5taW4obWVyZ2UsIHRoaXMuc2V0dGluZ3MuaXRlbXMpIHx8IG1lcmdlO1xuXG5cdFx0XHRcdGNhY2hlLml0ZW1zLm1lcmdlID0gbWVyZ2UgPiAxIHx8IGNhY2hlLml0ZW1zLm1lcmdlO1xuXG5cdFx0XHRcdHdpZHRoc1tpdGVyYXRvcl0gPSAhZ3JpZCA/IHRoaXMuX2l0ZW1zW2l0ZXJhdG9yXS53aWR0aCgpIDogd2lkdGggKiBtZXJnZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fd2lkdGhzID0gd2lkdGhzO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBjbG9uZXMgPSBbXSxcblx0XHRcdFx0aXRlbXMgPSB0aGlzLl9pdGVtcyxcblx0XHRcdFx0c2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzLFxuXHRcdFx0XHQvLyBUT0RPOiBTaG91bGQgYmUgY29tcHV0ZWQgZnJvbSBudW1iZXIgb2YgbWluIHdpZHRoIGl0ZW1zIGluIHN0YWdlXG5cdFx0XHRcdHZpZXcgPSBNYXRoLm1heChzZXR0aW5ncy5pdGVtcyAqIDIsIDQpLFxuXHRcdFx0XHRzaXplID0gTWF0aC5jZWlsKGl0ZW1zLmxlbmd0aCAvIDIpICogMixcblx0XHRcdFx0cmVwZWF0ID0gc2V0dGluZ3MubG9vcCAmJiBpdGVtcy5sZW5ndGggPyBzZXR0aW5ncy5yZXdpbmQgPyB2aWV3IDogTWF0aC5tYXgodmlldywgc2l6ZSkgOiAwLFxuXHRcdFx0XHRhcHBlbmQgPSAnJyxcblx0XHRcdFx0cHJlcGVuZCA9ICcnO1xuXG5cdFx0XHRyZXBlYXQgLz0gMjtcblxuXHRcdFx0d2hpbGUgKHJlcGVhdCA+IDApIHtcblx0XHRcdFx0Ly8gU3dpdGNoIHRvIG9ubHkgdXNpbmcgYXBwZW5kZWQgY2xvbmVzXG5cdFx0XHRcdGNsb25lcy5wdXNoKHRoaXMubm9ybWFsaXplKGNsb25lcy5sZW5ndGggLyAyLCB0cnVlKSk7XG5cdFx0XHRcdGFwcGVuZCA9IGFwcGVuZCArIGl0ZW1zW2Nsb25lc1tjbG9uZXMubGVuZ3RoIC0gMV1dWzBdLm91dGVySFRNTDtcblx0XHRcdFx0Y2xvbmVzLnB1c2godGhpcy5ub3JtYWxpemUoaXRlbXMubGVuZ3RoIC0gMSAtIChjbG9uZXMubGVuZ3RoIC0gMSkgLyAyLCB0cnVlKSk7XG5cdFx0XHRcdHByZXBlbmQgPSBpdGVtc1tjbG9uZXNbY2xvbmVzLmxlbmd0aCAtIDFdXVswXS5vdXRlckhUTUwgKyBwcmVwZW5kO1xuXHRcdFx0XHRyZXBlYXQgLT0gMTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY2xvbmVzID0gY2xvbmVzO1xuXG5cdFx0XHQkKGFwcGVuZCkuYWRkQ2xhc3MoJ2Nsb25lZCcpLmFwcGVuZFRvKHRoaXMuJHN0YWdlKTtcblx0XHRcdCQocHJlcGVuZCkuYWRkQ2xhc3MoJ2Nsb25lZCcpLnByZXBlbmRUbyh0aGlzLiRzdGFnZSk7XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcblx0XHRydW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHJ0bCA9IHRoaXMuc2V0dGluZ3MucnRsID8gMSA6IC0xLFxuXHRcdFx0XHRzaXplID0gdGhpcy5fY2xvbmVzLmxlbmd0aCArIHRoaXMuX2l0ZW1zLmxlbmd0aCxcblx0XHRcdFx0aXRlcmF0b3IgPSAtMSxcblx0XHRcdFx0cHJldmlvdXMgPSAwLFxuXHRcdFx0XHRjdXJyZW50ID0gMCxcblx0XHRcdFx0Y29vcmRpbmF0ZXMgPSBbXTtcblxuXHRcdFx0d2hpbGUgKCsraXRlcmF0b3IgPCBzaXplKSB7XG5cdFx0XHRcdHByZXZpb3VzID0gY29vcmRpbmF0ZXNbaXRlcmF0b3IgLSAxXSB8fCAwO1xuXHRcdFx0XHRjdXJyZW50ID0gdGhpcy5fd2lkdGhzW3RoaXMucmVsYXRpdmUoaXRlcmF0b3IpXSArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xuXHRcdFx0XHRjb29yZGluYXRlcy5wdXNoKHByZXZpb3VzICsgY3VycmVudCAqIHJ0bCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2Nvb3JkaW5hdGVzID0gY29vcmRpbmF0ZXM7XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICd3aWR0aCcsICdpdGVtcycsICdzZXR0aW5ncycgXSxcblx0XHRydW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHBhZGRpbmcgPSB0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyxcblx0XHRcdFx0Y29vcmRpbmF0ZXMgPSB0aGlzLl9jb29yZGluYXRlcyxcblx0XHRcdFx0Y3NzID0ge1xuXHRcdFx0XHRcdCd3aWR0aCc6IE1hdGguY2VpbChNYXRoLmFicyhjb29yZGluYXRlc1tjb29yZGluYXRlcy5sZW5ndGggLSAxXSkpICsgcGFkZGluZyAqIDIsXG5cdFx0XHRcdFx0J3BhZGRpbmctbGVmdCc6IHBhZGRpbmcgfHwgJycsXG5cdFx0XHRcdFx0J3BhZGRpbmctcmlnaHQnOiBwYWRkaW5nIHx8ICcnXG5cdFx0XHRcdH07XG5cblx0XHRcdHRoaXMuJHN0YWdlLmNzcyhjc3MpO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xuXHRcdFx0dmFyIGl0ZXJhdG9yID0gdGhpcy5fY29vcmRpbmF0ZXMubGVuZ3RoLFxuXHRcdFx0XHRncmlkID0gIXRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoLFxuXHRcdFx0XHRpdGVtcyA9IHRoaXMuJHN0YWdlLmNoaWxkcmVuKCk7XG5cblx0XHRcdGlmIChncmlkICYmIGNhY2hlLml0ZW1zLm1lcmdlKSB7XG5cdFx0XHRcdHdoaWxlIChpdGVyYXRvci0tKSB7XG5cdFx0XHRcdFx0Y2FjaGUuY3NzLndpZHRoID0gdGhpcy5fd2lkdGhzW3RoaXMucmVsYXRpdmUoaXRlcmF0b3IpXTtcblx0XHRcdFx0XHRpdGVtcy5lcShpdGVyYXRvcikuY3NzKGNhY2hlLmNzcyk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZ3JpZCkge1xuXHRcdFx0XHRjYWNoZS5jc3Mud2lkdGggPSBjYWNoZS5pdGVtcy53aWR0aDtcblx0XHRcdFx0aXRlbXMuY3NzKGNhY2hlLmNzcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICdpdGVtcycgXSxcblx0XHRydW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5fY29vcmRpbmF0ZXMubGVuZ3RoIDwgMSAmJiB0aGlzLiRzdGFnZS5yZW1vdmVBdHRyKCdzdHlsZScpO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbihjYWNoZSkge1xuXHRcdFx0Y2FjaGUuY3VycmVudCA9IGNhY2hlLmN1cnJlbnQgPyB0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmluZGV4KGNhY2hlLmN1cnJlbnQpIDogMDtcblx0XHRcdGNhY2hlLmN1cnJlbnQgPSBNYXRoLm1heCh0aGlzLm1pbmltdW0oKSwgTWF0aC5taW4odGhpcy5tYXhpbXVtKCksIGNhY2hlLmN1cnJlbnQpKTtcblx0XHRcdHRoaXMucmVzZXQoY2FjaGUuY3VycmVudCk7XG5cdFx0fVxuXHR9LCB7XG5cdFx0ZmlsdGVyOiBbICdwb3NpdGlvbicgXSxcblx0XHRydW46IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5hbmltYXRlKHRoaXMuY29vcmRpbmF0ZXModGhpcy5fY3VycmVudCkpO1xuXHRcdH1cblx0fSwge1xuXHRcdGZpbHRlcjogWyAnd2lkdGgnLCAncG9zaXRpb24nLCAnaXRlbXMnLCAnc2V0dGluZ3MnIF0sXG5cdFx0cnVuOiBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBydGwgPSB0aGlzLnNldHRpbmdzLnJ0bCA/IDEgOiAtMSxcblx0XHRcdFx0cGFkZGluZyA9IHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nICogMixcblx0XHRcdFx0YmVnaW4gPSB0aGlzLmNvb3JkaW5hdGVzKHRoaXMuY3VycmVudCgpKSArIHBhZGRpbmcsXG5cdFx0XHRcdGVuZCA9IGJlZ2luICsgdGhpcy53aWR0aCgpICogcnRsLFxuXHRcdFx0XHRpbm5lciwgb3V0ZXIsIG1hdGNoZXMgPSBbXSwgaSwgbjtcblxuXHRcdFx0Zm9yIChpID0gMCwgbiA9IHRoaXMuX2Nvb3JkaW5hdGVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuXHRcdFx0XHRpbm5lciA9IHRoaXMuX2Nvb3JkaW5hdGVzW2kgLSAxXSB8fCAwO1xuXHRcdFx0XHRvdXRlciA9IE1hdGguYWJzKHRoaXMuX2Nvb3JkaW5hdGVzW2ldKSArIHBhZGRpbmcgKiBydGw7XG5cblx0XHRcdFx0aWYgKCh0aGlzLm9wKGlubmVyLCAnPD0nLCBiZWdpbikgJiYgKHRoaXMub3AoaW5uZXIsICc+JywgZW5kKSkpXG5cdFx0XHRcdFx0fHwgKHRoaXMub3Aob3V0ZXIsICc8JywgYmVnaW4pICYmIHRoaXMub3Aob3V0ZXIsICc+JywgZW5kKSkpIHtcblx0XHRcdFx0XHRtYXRjaGVzLnB1c2goaSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oJy5hY3RpdmUnKS5yZW1vdmVDbGFzcygnYWN0aXZlJyk7XG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignOmVxKCcgKyBtYXRjaGVzLmpvaW4oJyksIDplcSgnKSArICcpJykuYWRkQ2xhc3MoJ2FjdGl2ZScpO1xuXG5cdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbignLmNlbnRlcicpLnJlbW92ZUNsYXNzKCdjZW50ZXInKTtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLmNlbnRlcikge1xuXHRcdFx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmVxKHRoaXMuY3VycmVudCgpKS5hZGRDbGFzcygnY2VudGVyJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IF07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSB0aGUgc3RhZ2UgRE9NIGVsZW1lbnRcblx0ICovXG5cdE93bC5wcm90b3R5cGUuaW5pdGlhbGl6ZVN0YWdlID0gZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy4kc3RhZ2UgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy4nICsgdGhpcy5zZXR0aW5ncy5zdGFnZUNsYXNzKTtcblxuXHRcdC8vIGlmIHRoZSBzdGFnZSBpcyBhbHJlYWR5IGluIHRoZSBET00sIGdyYWIgaXQgYW5kIHNraXAgc3RhZ2UgaW5pdGlhbGl6YXRpb25cblx0XHRpZiAodGhpcy4kc3RhZ2UubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGluZ0NsYXNzKTtcblxuXHRcdC8vIGNyZWF0ZSBzdGFnZVxuXHRcdHRoaXMuJHN0YWdlID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLnN0YWdlRWxlbWVudCArICc+Jywge1xuXHRcdFx0XCJjbGFzc1wiOiB0aGlzLnNldHRpbmdzLnN0YWdlQ2xhc3Ncblx0XHR9KS53cmFwKCAkKCAnPGRpdi8+Jywge1xuXHRcdFx0XCJjbGFzc1wiOiB0aGlzLnNldHRpbmdzLnN0YWdlT3V0ZXJDbGFzc1xuXHRcdH0pKTtcblxuXHRcdC8vIGFwcGVuZCBzdGFnZVxuXHRcdHRoaXMuJGVsZW1lbnQuYXBwZW5kKHRoaXMuJHN0YWdlLnBhcmVudCgpKTtcblx0fTtcblxuXHQvKipcblx0ICogQ3JlYXRlIGl0ZW0gRE9NIGVsZW1lbnRzXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmluaXRpYWxpemVJdGVtcyA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciAkaXRlbXMgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5vd2wtaXRlbScpO1xuXG5cdFx0Ly8gaWYgdGhlIGl0ZW1zIGFyZSBhbHJlYWR5IGluIHRoZSBET00sIGdyYWIgdGhlbSBhbmQgc2tpcCBpdGVtIGluaXRpYWxpemF0aW9uXG5cdFx0aWYgKCRpdGVtcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX2l0ZW1zID0gJGl0ZW1zLmdldCgpLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiAkKGl0ZW0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX21lcmdlcnMgPSB0aGlzLl9pdGVtcy5tYXAoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gYXBwZW5kIGNvbnRlbnRcblx0XHR0aGlzLnJlcGxhY2UodGhpcy4kZWxlbWVudC5jaGlsZHJlbigpLm5vdCh0aGlzLiRzdGFnZS5wYXJlbnQoKSkpO1xuXG5cdFx0Ly8gY2hlY2sgdmlzaWJpbGl0eVxuXHRcdGlmICh0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHQvLyB1cGRhdGUgdmlld1xuXHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGludmFsaWRhdGUgd2lkdGhcblx0XHRcdHRoaXMuaW52YWxpZGF0ZSgnd2lkdGgnKTtcblx0XHR9XG5cblx0XHR0aGlzLiRlbGVtZW50XG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmxvYWRpbmdDbGFzcylcblx0XHRcdC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGVkQ2xhc3MpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBJbml0aWFsaXplcyB0aGUgY2Fyb3VzZWwuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE93bC5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZW50ZXIoJ2luaXRpYWxpemluZycpO1xuXHRcdHRoaXMudHJpZ2dlcignaW5pdGlhbGl6ZScpO1xuXG5cdFx0dGhpcy4kZWxlbWVudC50b2dnbGVDbGFzcyh0aGlzLnNldHRpbmdzLnJ0bENsYXNzLCB0aGlzLnNldHRpbmdzLnJ0bCk7XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5hdXRvV2lkdGggJiYgIXRoaXMuaXMoJ3ByZS1sb2FkaW5nJykpIHtcblx0XHRcdHZhciBpbWdzLCBuZXN0ZWRTZWxlY3Rvciwgd2lkdGg7XG5cdFx0XHRpbWdzID0gdGhpcy4kZWxlbWVudC5maW5kKCdpbWcnKTtcblx0XHRcdG5lc3RlZFNlbGVjdG9yID0gdGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IgPyAnLicgKyB0aGlzLnNldHRpbmdzLm5lc3RlZEl0ZW1TZWxlY3RvciA6IHVuZGVmaW5lZDtcblx0XHRcdHdpZHRoID0gdGhpcy4kZWxlbWVudC5jaGlsZHJlbihuZXN0ZWRTZWxlY3Rvcikud2lkdGgoKTtcblxuXHRcdFx0aWYgKGltZ3MubGVuZ3RoICYmIHdpZHRoIDw9IDApIHtcblx0XHRcdFx0dGhpcy5wcmVsb2FkQXV0b1dpZHRoSW1hZ2VzKGltZ3MpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaW5pdGlhbGl6ZVN0YWdlKCk7XG5cdFx0dGhpcy5pbml0aWFsaXplSXRlbXMoKTtcblxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJzXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50SGFuZGxlcnMoKTtcblxuXHRcdHRoaXMubGVhdmUoJ2luaXRpYWxpemluZycpO1xuXHRcdHRoaXMudHJpZ2dlcignaW5pdGlhbGl6ZWQnKTtcblx0fTtcblxuXHQvKipcblx0ICogQHJldHVybnMge0Jvb2xlYW59IHZpc2liaWxpdHkgb2YgJGVsZW1lbnRcblx0ICogICAgICAgICAgICAgICAgICAgIGlmIHlvdSBrbm93IHRoZSBjYXJvdXNlbCB3aWxsIGFsd2F5cyBiZSB2aXNpYmxlIHlvdSBjYW4gc2V0IGBjaGVja1Zpc2liaWxpdHlgIHRvIGBmYWxzZWAgdG9cblx0ICogICAgICAgICAgICAgICAgICAgIHByZXZlbnQgdGhlIGV4cGVuc2l2ZSBicm93c2VyIGxheW91dCBmb3JjZWQgcmVmbG93IHRoZSAkZWxlbWVudC5pcygnOnZpc2libGUnKSBkb2VzXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmlzVmlzaWJsZSA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLnNldHRpbmdzLmNoZWNrVmlzaWJpbGl0eVxuXHRcdFx0PyB0aGlzLiRlbGVtZW50LmlzKCc6dmlzaWJsZScpXG5cdFx0XHQ6IHRydWU7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHVwcyB0aGUgY3VycmVudCBzZXR0aW5ncy5cblx0ICogQHRvZG8gUmVtb3ZlIHJlc3BvbnNpdmUgY2xhc3Nlcy4gV2h5IHNob3VsZCBhZGFwdGl2ZSBkZXNpZ25zIGJlIGJyb3VnaHQgaW50byBJRTg/XG5cdCAqIEB0b2RvIFN1cHBvcnQgZm9yIG1lZGlhIHF1ZXJpZXMgYnkgdXNpbmcgYG1hdGNoTWVkaWFgIHdvdWxkIGJlIG5pY2UuXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdE93bC5wcm90b3R5cGUuc2V0dXAgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdmlld3BvcnQgPSB0aGlzLnZpZXdwb3J0KCksXG5cdFx0XHRvdmVyd3JpdGVzID0gdGhpcy5vcHRpb25zLnJlc3BvbnNpdmUsXG5cdFx0XHRtYXRjaCA9IC0xLFxuXHRcdFx0c2V0dGluZ3MgPSBudWxsO1xuXG5cdFx0aWYgKCFvdmVyd3JpdGVzKSB7XG5cdFx0XHRzZXR0aW5ncyA9ICQuZXh0ZW5kKHt9LCB0aGlzLm9wdGlvbnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQkLmVhY2gob3ZlcndyaXRlcywgZnVuY3Rpb24oYnJlYWtwb2ludCkge1xuXHRcdFx0XHRpZiAoYnJlYWtwb2ludCA8PSB2aWV3cG9ydCAmJiBicmVha3BvaW50ID4gbWF0Y2gpIHtcblx0XHRcdFx0XHRtYXRjaCA9IE51bWJlcihicmVha3BvaW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHNldHRpbmdzID0gJC5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgb3ZlcndyaXRlc1ttYXRjaF0pO1xuXHRcdFx0aWYgKHR5cGVvZiBzZXR0aW5ncy5zdGFnZVBhZGRpbmcgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0c2V0dGluZ3Muc3RhZ2VQYWRkaW5nID0gc2V0dGluZ3Muc3RhZ2VQYWRkaW5nKCk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgc2V0dGluZ3MucmVzcG9uc2l2ZTtcblxuXHRcdFx0Ly8gcmVzcG9uc2l2ZSBjbGFzc1xuXHRcdFx0aWYgKHNldHRpbmdzLnJlc3BvbnNpdmVDbGFzcykge1xuXHRcdFx0XHR0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJyxcblx0XHRcdFx0XHR0aGlzLiRlbGVtZW50LmF0dHIoJ2NsYXNzJykucmVwbGFjZShuZXcgUmVnRXhwKCcoJyArIHRoaXMub3B0aW9ucy5yZXNwb25zaXZlQ2xhc3MgKyAnLSlcXFxcUytcXFxccycsICdnJyksICckMScgKyBtYXRjaClcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnRyaWdnZXIoJ2NoYW5nZScsIHsgcHJvcGVydHk6IHsgbmFtZTogJ3NldHRpbmdzJywgdmFsdWU6IHNldHRpbmdzIH0gfSk7XG5cdFx0dGhpcy5fYnJlYWtwb2ludCA9IG1hdGNoO1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcblx0XHR0aGlzLmludmFsaWRhdGUoJ3NldHRpbmdzJyk7XG5cdFx0dGhpcy50cmlnZ2VyKCdjaGFuZ2VkJywgeyBwcm9wZXJ0eTogeyBuYW1lOiAnc2V0dGluZ3MnLCB2YWx1ZTogdGhpcy5zZXR0aW5ncyB9IH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIG9wdGlvbiBsb2dpYyBpZiBuZWNlc3NlcnkuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE93bC5wcm90b3R5cGUub3B0aW9uc0xvZ2ljID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuYXV0b1dpZHRoKSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzLnN0YWdlUGFkZGluZyA9IGZhbHNlO1xuXHRcdFx0dGhpcy5zZXR0aW5ncy5tZXJnZSA9IGZhbHNlO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogUHJlcGFyZXMgYW4gaXRlbSBiZWZvcmUgYWRkLlxuXHQgKiBAdG9kbyBSZW5hbWUgZXZlbnQgcGFyYW1ldGVyIGBjb250ZW50YCB0byBgaXRlbWAuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHJldHVybnMge2pRdWVyeXxIVE1MRWxlbWVudH0gLSBUaGUgaXRlbSBjb250YWluZXIuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLnByZXBhcmUgPSBmdW5jdGlvbihpdGVtKSB7XG5cdFx0dmFyIGV2ZW50ID0gdGhpcy50cmlnZ2VyKCdwcmVwYXJlJywgeyBjb250ZW50OiBpdGVtIH0pO1xuXG5cdFx0aWYgKCFldmVudC5kYXRhKSB7XG5cdFx0XHRldmVudC5kYXRhID0gJCgnPCcgKyB0aGlzLnNldHRpbmdzLml0ZW1FbGVtZW50ICsgJy8+Jylcblx0XHRcdFx0LmFkZENsYXNzKHRoaXMub3B0aW9ucy5pdGVtQ2xhc3MpLmFwcGVuZChpdGVtKVxuXHRcdH1cblxuXHRcdHRoaXMudHJpZ2dlcigncHJlcGFyZWQnLCB7IGNvbnRlbnQ6IGV2ZW50LmRhdGEgfSk7XG5cblx0XHRyZXR1cm4gZXZlbnQuZGF0YTtcblx0fTtcblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgdmlldy5cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0T3dsLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgaSA9IDAsXG5cdFx0XHRuID0gdGhpcy5fcGlwZS5sZW5ndGgsXG5cdFx0XHRmaWx0ZXIgPSAkLnByb3h5KGZ1bmN0aW9uKHApIHsgcmV0dXJuIHRoaXNbcF0gfSwgdGhpcy5faW52YWxpZGF0ZWQpLFxuXHRcdFx0Y2FjaGUgPSB7fTtcblxuXHRcdHdoaWxlIChpIDwgbikge1xuXHRcdFx0aWYgKHRoaXMuX2ludmFsaWRhdGVkLmFsbCB8fCAkLmdyZXAodGhpcy5fcGlwZVtpXS5maWx0ZXIsIGZpbHRlcikubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0aGlzLl9waXBlW2ldLnJ1bihjYWNoZSk7XG5cdFx0XHR9XG5cdFx0XHRpKys7XG5cdFx0fVxuXG5cdFx0dGhpcy5faW52YWxpZGF0ZWQgPSB7fTtcblxuXHRcdCF0aGlzLmlzKCd2YWxpZCcpICYmIHRoaXMuZW50ZXIoJ3ZhbGlkJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHdpZHRoIG9mIHRoZSB2aWV3LlxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7T3dsLldpZHRofSBbZGltZW5zaW9uPU93bC5XaWR0aC5EZWZhdWx0XSAtIFRoZSBkaW1lbnNpb24gdG8gcmV0dXJuLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSB3aWR0aCBvZiB0aGUgdmlldyBpbiBwaXhlbC5cblx0ICovXG5cdE93bC5wcm90b3R5cGUud2lkdGggPSBmdW5jdGlvbihkaW1lbnNpb24pIHtcblx0XHRkaW1lbnNpb24gPSBkaW1lbnNpb24gfHwgT3dsLldpZHRoLkRlZmF1bHQ7XG5cdFx0c3dpdGNoIChkaW1lbnNpb24pIHtcblx0XHRcdGNhc2UgT3dsLldpZHRoLklubmVyOlxuXHRcdFx0Y2FzZSBPd2wuV2lkdGguT3V0ZXI6XG5cdFx0XHRcdHJldHVybiB0aGlzLl93aWR0aDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLl93aWR0aCAtIHRoaXMuc2V0dGluZ3Muc3RhZ2VQYWRkaW5nICogMiArIHRoaXMuc2V0dGluZ3MubWFyZ2luO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogUmVmcmVzaGVzIHRoZSBjYXJvdXNlbCBwcmltYXJpbHkgZm9yIGFkYXB0aXZlIHB1cnBvc2VzLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLnJlZnJlc2ggPSBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmVudGVyKCdyZWZyZXNoaW5nJyk7XG5cdFx0dGhpcy50cmlnZ2VyKCdyZWZyZXNoJyk7XG5cblx0XHR0aGlzLnNldHVwKCk7XG5cblx0XHR0aGlzLm9wdGlvbnNMb2dpYygpO1xuXG5cdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMucmVmcmVzaENsYXNzKTtcblxuXHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHR0aGlzLiRlbGVtZW50LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5yZWZyZXNoQ2xhc3MpO1xuXG5cdFx0dGhpcy5sZWF2ZSgncmVmcmVzaGluZycpO1xuXHRcdHRoaXMudHJpZ2dlcigncmVmcmVzaGVkJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENoZWNrcyB3aW5kb3cgYHJlc2l6ZWAgZXZlbnQuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE93bC5wcm90b3R5cGUub25UaHJvdHRsZWRSZXNpemUgPSBmdW5jdGlvbigpIHtcblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmVzaXplVGltZXIpO1xuXHRcdHRoaXMucmVzaXplVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCh0aGlzLl9oYW5kbGVycy5vblJlc2l6ZSwgdGhpcy5zZXR0aW5ncy5yZXNwb25zaXZlUmVmcmVzaFJhdGUpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDaGVja3Mgd2luZG93IGByZXNpemVgIGV2ZW50LlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLm9uUmVzaXplID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCF0aGlzLl9pdGVtcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fd2lkdGggPT09IHRoaXMuJGVsZW1lbnQud2lkdGgoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMuZW50ZXIoJ3Jlc2l6aW5nJyk7XG5cblx0XHRpZiAodGhpcy50cmlnZ2VyKCdyZXNpemUnKS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkge1xuXHRcdFx0dGhpcy5sZWF2ZSgncmVzaXppbmcnKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLmludmFsaWRhdGUoJ3dpZHRoJyk7XG5cblx0XHR0aGlzLnJlZnJlc2goKTtcblxuXHRcdHRoaXMubGVhdmUoJ3Jlc2l6aW5nJyk7XG5cdFx0dGhpcy50cmlnZ2VyKCdyZXNpemVkJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFJlZ2lzdGVycyBldmVudCBoYW5kbGVycy5cblx0ICogQHRvZG8gQ2hlY2sgYG1zUG9pbnRlckVuYWJsZWRgXG5cdCAqIEB0b2RvICMyNjFcblx0ICogQHByb3RlY3RlZFxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5yZWdpc3RlckV2ZW50SGFuZGxlcnMgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCQuc3VwcG9ydC50cmFuc2l0aW9uLmVuZCArICcub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25UcmFuc2l0aW9uRW5kLCB0aGlzKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MucmVzcG9uc2l2ZSAhPT0gZmFsc2UpIHtcblx0XHRcdHRoaXMub24od2luZG93LCAncmVzaXplJywgdGhpcy5faGFuZGxlcnMub25UaHJvdHRsZWRSZXNpemUpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNldHRpbmdzLm1vdXNlRHJhZykge1xuXHRcdFx0dGhpcy4kZWxlbWVudC5hZGRDbGFzcyh0aGlzLm9wdGlvbnMuZHJhZ0NsYXNzKTtcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCdtb3VzZWRvd24ub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnU3RhcnQsIHRoaXMpKTtcblx0XHRcdHRoaXMuJHN0YWdlLm9uKCdkcmFnc3RhcnQub3dsLmNvcmUgc2VsZWN0c3RhcnQub3dsLmNvcmUnLCBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlIH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNldHRpbmdzLnRvdWNoRHJhZyl7XG5cdFx0XHR0aGlzLiRzdGFnZS5vbigndG91Y2hzdGFydC5vd2wuY29yZScsICQucHJveHkodGhpcy5vbkRyYWdTdGFydCwgdGhpcykpO1xuXHRcdFx0dGhpcy4kc3RhZ2Uub24oJ3RvdWNoY2FuY2VsLm93bC5jb3JlJywgJC5wcm94eSh0aGlzLm9uRHJhZ0VuZCwgdGhpcykpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogSGFuZGxlcyBgdG91Y2hzdGFydGAgYW5kIGBtb3VzZWRvd25gIGV2ZW50cy5cblx0ICogQHRvZG8gSG9yaXpvbnRhbCBzd2lwZSB0aHJlc2hvbGQgYXMgb3B0aW9uXG5cdCAqIEB0b2RvICMyNjFcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBhcmd1bWVudHMuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLm9uRHJhZ1N0YXJ0ID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgc3RhZ2UgPSBudWxsO1xuXG5cdFx0aWYgKGV2ZW50LndoaWNoID09PSAzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCQuc3VwcG9ydC50cmFuc2Zvcm0pIHtcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UuY3NzKCd0cmFuc2Zvcm0nKS5yZXBsYWNlKC8uKlxcKHxcXCl8IC9nLCAnJykuc3BsaXQoJywnKTtcblx0XHRcdHN0YWdlID0ge1xuXHRcdFx0XHR4OiBzdGFnZVtzdGFnZS5sZW5ndGggPT09IDE2ID8gMTIgOiA0XSxcblx0XHRcdFx0eTogc3RhZ2Vbc3RhZ2UubGVuZ3RoID09PSAxNiA/IDEzIDogNV1cblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHN0YWdlID0gdGhpcy4kc3RhZ2UucG9zaXRpb24oKTtcblx0XHRcdHN0YWdlID0ge1xuXHRcdFx0XHR4OiB0aGlzLnNldHRpbmdzLnJ0bCA/XG5cdFx0XHRcdFx0c3RhZ2UubGVmdCArIHRoaXMuJHN0YWdlLndpZHRoKCkgLSB0aGlzLndpZHRoKCkgKyB0aGlzLnNldHRpbmdzLm1hcmdpbiA6XG5cdFx0XHRcdFx0c3RhZ2UubGVmdCxcblx0XHRcdFx0eTogc3RhZ2UudG9wXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzKCdhbmltYXRpbmcnKSkge1xuXHRcdFx0JC5zdXBwb3J0LnRyYW5zZm9ybSA/IHRoaXMuYW5pbWF0ZShzdGFnZS54KSA6IHRoaXMuJHN0YWdlLnN0b3AoKVxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCdwb3NpdGlvbicpO1xuXHRcdH1cblxuXHRcdHRoaXMuJGVsZW1lbnQudG9nZ2xlQ2xhc3ModGhpcy5vcHRpb25zLmdyYWJDbGFzcywgZXZlbnQudHlwZSA9PT0gJ21vdXNlZG93bicpO1xuXG5cdFx0dGhpcy5zcGVlZCgwKTtcblxuXHRcdHRoaXMuX2RyYWcudGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHRcdHRoaXMuX2RyYWcudGFyZ2V0ID0gJChldmVudC50YXJnZXQpO1xuXHRcdHRoaXMuX2RyYWcuc3RhZ2Uuc3RhcnQgPSBzdGFnZTtcblx0XHR0aGlzLl9kcmFnLnN0YWdlLmN1cnJlbnQgPSBzdGFnZTtcblx0XHR0aGlzLl9kcmFnLnBvaW50ZXIgPSB0aGlzLnBvaW50ZXIoZXZlbnQpO1xuXG5cdFx0JChkb2N1bWVudCkub24oJ21vdXNldXAub3dsLmNvcmUgdG91Y2hlbmQub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnRW5kLCB0aGlzKSk7XG5cblx0XHQkKGRvY3VtZW50KS5vbmUoJ21vdXNlbW92ZS5vd2wuY29yZSB0b3VjaG1vdmUub3dsLmNvcmUnLCAkLnByb3h5KGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHR2YXIgZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKTtcblxuXHRcdFx0JChkb2N1bWVudCkub24oJ21vdXNlbW92ZS5vd2wuY29yZSB0b3VjaG1vdmUub3dsLmNvcmUnLCAkLnByb3h5KHRoaXMub25EcmFnTW92ZSwgdGhpcykpO1xuXG5cdFx0XHRpZiAoTWF0aC5hYnMoZGVsdGEueCkgPCBNYXRoLmFicyhkZWx0YS55KSAmJiB0aGlzLmlzKCd2YWxpZCcpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dGhpcy5lbnRlcignZHJhZ2dpbmcnKTtcblx0XHRcdHRoaXMudHJpZ2dlcignZHJhZycpO1xuXHRcdH0sIHRoaXMpKTtcblx0fTtcblxuXHQvKipcblx0ICogSGFuZGxlcyB0aGUgYHRvdWNobW92ZWAgYW5kIGBtb3VzZW1vdmVgIGV2ZW50cy5cblx0ICogQHRvZG8gIzI2MVxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cblx0ICovXG5cdE93bC5wcm90b3R5cGUub25EcmFnTW92ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0dmFyIG1pbmltdW0gPSBudWxsLFxuXHRcdFx0bWF4aW11bSA9IG51bGwsXG5cdFx0XHRwdWxsID0gbnVsbCxcblx0XHRcdGRlbHRhID0gdGhpcy5kaWZmZXJlbmNlKHRoaXMuX2RyYWcucG9pbnRlciwgdGhpcy5wb2ludGVyKGV2ZW50KSksXG5cdFx0XHRzdGFnZSA9IHRoaXMuZGlmZmVyZW5jZSh0aGlzLl9kcmFnLnN0YWdlLnN0YXJ0LCBkZWx0YSk7XG5cblx0XHRpZiAoIXRoaXMuaXMoJ2RyYWdnaW5nJykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MubG9vcCkge1xuXHRcdFx0bWluaW11bSA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpO1xuXHRcdFx0bWF4aW11bSA9IHRoaXMuY29vcmRpbmF0ZXModGhpcy5tYXhpbXVtKCkgKyAxKSAtIG1pbmltdW07XG5cdFx0XHRzdGFnZS54ID0gKCgoc3RhZ2UueCAtIG1pbmltdW0pICUgbWF4aW11bSArIG1heGltdW0pICUgbWF4aW11bSkgKyBtaW5pbXVtO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtaW5pbXVtID0gdGhpcy5zZXR0aW5ncy5ydGwgPyB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWF4aW11bSgpKSA6IHRoaXMuY29vcmRpbmF0ZXModGhpcy5taW5pbXVtKCkpO1xuXHRcdFx0bWF4aW11bSA9IHRoaXMuc2V0dGluZ3MucnRsID8gdGhpcy5jb29yZGluYXRlcyh0aGlzLm1pbmltdW0oKSkgOiB0aGlzLmNvb3JkaW5hdGVzKHRoaXMubWF4aW11bSgpKTtcblx0XHRcdHB1bGwgPSB0aGlzLnNldHRpbmdzLnB1bGxEcmFnID8gLTEgKiBkZWx0YS54IC8gNSA6IDA7XG5cdFx0XHRzdGFnZS54ID0gTWF0aC5tYXgoTWF0aC5taW4oc3RhZ2UueCwgbWluaW11bSArIHB1bGwpLCBtYXhpbXVtICsgcHVsbCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZHJhZy5zdGFnZS5jdXJyZW50ID0gc3RhZ2U7XG5cblx0XHR0aGlzLmFuaW1hdGUoc3RhZ2UueCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEhhbmRsZXMgdGhlIGB0b3VjaGVuZGAgYW5kIGBtb3VzZXVwYCBldmVudHMuXG5cdCAqIEB0b2RvICMyNjFcblx0ICogQHRvZG8gVGhyZXNob2xkIGZvciBjbGljayBldmVudFxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IGFyZ3VtZW50cy5cblx0ICovXG5cdE93bC5wcm90b3R5cGUub25EcmFnRW5kID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgZGVsdGEgPSB0aGlzLmRpZmZlcmVuY2UodGhpcy5fZHJhZy5wb2ludGVyLCB0aGlzLnBvaW50ZXIoZXZlbnQpKSxcblx0XHRcdHN0YWdlID0gdGhpcy5fZHJhZy5zdGFnZS5jdXJyZW50LFxuXHRcdFx0ZGlyZWN0aW9uID0gZGVsdGEueCA+IDAgXiB0aGlzLnNldHRpbmdzLnJ0bCA/ICdsZWZ0JyA6ICdyaWdodCc7XG5cblx0XHQkKGRvY3VtZW50KS5vZmYoJy5vd2wuY29yZScpO1xuXG5cdFx0dGhpcy4kZWxlbWVudC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZ3JhYkNsYXNzKTtcblxuXHRcdGlmIChkZWx0YS54ICE9PSAwICYmIHRoaXMuaXMoJ2RyYWdnaW5nJykgfHwgIXRoaXMuaXMoJ3ZhbGlkJykpIHtcblx0XHRcdHRoaXMuc3BlZWQodGhpcy5zZXR0aW5ncy5kcmFnRW5kU3BlZWQgfHwgdGhpcy5zZXR0aW5ncy5zbWFydFNwZWVkKTtcblx0XHRcdHRoaXMuY3VycmVudCh0aGlzLmNsb3Nlc3Qoc3RhZ2UueCwgZGVsdGEueCAhPT0gMCA/IGRpcmVjdGlvbiA6IHRoaXMuX2RyYWcuZGlyZWN0aW9uKSk7XG5cdFx0XHR0aGlzLmludmFsaWRhdGUoJ3Bvc2l0aW9uJyk7XG5cdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXG5cdFx0XHR0aGlzLl9kcmFnLmRpcmVjdGlvbiA9IGRpcmVjdGlvbjtcblxuXHRcdFx0aWYgKE1hdGguYWJzKGRlbHRhLngpID4gMyB8fCBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX2RyYWcudGltZSA+IDMwMCkge1xuXHRcdFx0XHR0aGlzLl9kcmFnLnRhcmdldC5vbmUoJ2NsaWNrLm93bC5jb3JlJywgZnVuY3Rpb24oKSB7IHJldHVybiBmYWxzZTsgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmlzKCdkcmFnZ2luZycpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sZWF2ZSgnZHJhZ2dpbmcnKTtcblx0XHR0aGlzLnRyaWdnZXIoJ2RyYWdnZWQnKTtcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgY2xvc2VzdCBpdGVtIGZvciBhIGNvb3JkaW5hdGUuXG5cdCAqIEB0b2RvIFNldHRpbmcgYGZyZWVEcmFnYCBtYWtlcyBgY2xvc2VzdGAgbm90IHJldXNhYmxlLiBTZWUgIzE2NS5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge051bWJlcn0gY29vcmRpbmF0ZSAtIFRoZSBjb29yZGluYXRlIGluIHBpeGVsLlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZGlyZWN0aW9uIC0gVGhlIGRpcmVjdGlvbiB0byBjaGVjayBmb3IgdGhlIGNsb3Nlc3QgaXRlbS4gRXRoZXIgYGxlZnRgIG9yIGByaWdodGAuXG5cdCAqIEByZXR1cm4ge051bWJlcn0gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGNsb3Nlc3QgaXRlbS5cblx0ICovXG5cdE93bC5wcm90b3R5cGUuY2xvc2VzdCA9IGZ1bmN0aW9uKGNvb3JkaW5hdGUsIGRpcmVjdGlvbikge1xuXHRcdHZhciBwb3NpdGlvbiA9IC0xLFxuXHRcdFx0cHVsbCA9IDMwLFxuXHRcdFx0d2lkdGggPSB0aGlzLndpZHRoKCksXG5cdFx0XHRjb29yZGluYXRlcyA9IHRoaXMuY29vcmRpbmF0ZXMoKTtcblxuXHRcdGlmICghdGhpcy5zZXR0aW5ncy5mcmVlRHJhZykge1xuXHRcdFx0Ly8gY2hlY2sgY2xvc2VzdCBpdGVtXG5cdFx0XHQkLmVhY2goY29vcmRpbmF0ZXMsICQucHJveHkoZnVuY3Rpb24oaW5kZXgsIHZhbHVlKSB7XG5cdFx0XHRcdC8vIG9uIGEgbGVmdCBwdWxsLCBjaGVjayBvbiBjdXJyZW50IGluZGV4XG5cdFx0XHRcdGlmIChkaXJlY3Rpb24gPT09ICdsZWZ0JyAmJiBjb29yZGluYXRlID4gdmFsdWUgLSBwdWxsICYmIGNvb3JkaW5hdGUgPCB2YWx1ZSArIHB1bGwpIHtcblx0XHRcdFx0XHRwb3NpdGlvbiA9IGluZGV4O1xuXHRcdFx0XHQvLyBvbiBhIHJpZ2h0IHB1bGwsIGNoZWNrIG9uIHByZXZpb3VzIGluZGV4XG5cdFx0XHRcdC8vIHRvIGRvIHNvLCBzdWJ0cmFjdCB3aWR0aCBmcm9tIHZhbHVlIGFuZCBzZXQgcG9zaXRpb24gPSBpbmRleCArIDFcblx0XHRcdFx0fSBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICdyaWdodCcgJiYgY29vcmRpbmF0ZSA+IHZhbHVlIC0gd2lkdGggLSBwdWxsICYmIGNvb3JkaW5hdGUgPCB2YWx1ZSAtIHdpZHRoICsgcHVsbCkge1xuXHRcdFx0XHRcdHBvc2l0aW9uID0gaW5kZXggKyAxO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMub3AoY29vcmRpbmF0ZSwgJzwnLCB2YWx1ZSlcblx0XHRcdFx0XHQmJiB0aGlzLm9wKGNvb3JkaW5hdGUsICc+JywgY29vcmRpbmF0ZXNbaW5kZXggKyAxXSAhPT0gdW5kZWZpbmVkID8gY29vcmRpbmF0ZXNbaW5kZXggKyAxXSA6IHZhbHVlIC0gd2lkdGgpKSB7XG5cdFx0XHRcdFx0cG9zaXRpb24gPSBkaXJlY3Rpb24gPT09ICdsZWZ0JyA/IGluZGV4ICsgMSA6IGluZGV4O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwb3NpdGlvbiA9PT0gLTE7XG5cdFx0XHR9LCB0aGlzKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLmxvb3ApIHtcblx0XHRcdC8vIG5vbiBsb29wIGJvdW5kcmllc1xuXHRcdFx0aWYgKHRoaXMub3AoY29vcmRpbmF0ZSwgJz4nLCBjb29yZGluYXRlc1t0aGlzLm1pbmltdW0oKV0pKSB7XG5cdFx0XHRcdHBvc2l0aW9uID0gY29vcmRpbmF0ZSA9IHRoaXMubWluaW11bSgpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLm9wKGNvb3JkaW5hdGUsICc8JywgY29vcmRpbmF0ZXNbdGhpcy5tYXhpbXVtKCldKSkge1xuXHRcdFx0XHRwb3NpdGlvbiA9IGNvb3JkaW5hdGUgPSB0aGlzLm1heGltdW0oKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcG9zaXRpb247XG5cdH07XG5cblx0LyoqXG5cdCAqIEFuaW1hdGVzIHRoZSBzdGFnZS5cblx0ICogQHRvZG8gIzI3MFxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb29yZGluYXRlIC0gVGhlIGNvb3JkaW5hdGUgaW4gcGl4ZWxzLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5hbmltYXRlID0gZnVuY3Rpb24oY29vcmRpbmF0ZSkge1xuXHRcdHZhciBhbmltYXRlID0gdGhpcy5zcGVlZCgpID4gMDtcblxuXHRcdHRoaXMuaXMoJ2FuaW1hdGluZycpICYmIHRoaXMub25UcmFuc2l0aW9uRW5kKCk7XG5cblx0XHRpZiAoYW5pbWF0ZSkge1xuXHRcdFx0dGhpcy5lbnRlcignYW5pbWF0aW5nJyk7XG5cdFx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZScpO1xuXHRcdH1cblxuXHRcdGlmICgkLnN1cHBvcnQudHJhbnNmb3JtM2QgJiYgJC5zdXBwb3J0LnRyYW5zaXRpb24pIHtcblx0XHRcdHRoaXMuJHN0YWdlLmNzcyh7XG5cdFx0XHRcdHRyYW5zZm9ybTogJ3RyYW5zbGF0ZTNkKCcgKyBjb29yZGluYXRlICsgJ3B4LDBweCwwcHgpJyxcblx0XHRcdFx0dHJhbnNpdGlvbjogKHRoaXMuc3BlZWQoKSAvIDEwMDApICsgJ3MnICsgKFxuXHRcdFx0XHRcdHRoaXMuc2V0dGluZ3Muc2xpZGVUcmFuc2l0aW9uID8gJyAnICsgdGhpcy5zZXR0aW5ncy5zbGlkZVRyYW5zaXRpb24gOiAnJ1xuXHRcdFx0XHQpXG5cdFx0XHR9KTtcblx0XHR9IGVsc2UgaWYgKGFuaW1hdGUpIHtcblx0XHRcdHRoaXMuJHN0YWdlLmFuaW1hdGUoe1xuXHRcdFx0XHRsZWZ0OiBjb29yZGluYXRlICsgJ3B4J1xuXHRcdFx0fSwgdGhpcy5zcGVlZCgpLCB0aGlzLnNldHRpbmdzLmZhbGxiYWNrRWFzaW5nLCAkLnByb3h5KHRoaXMub25UcmFuc2l0aW9uRW5kLCB0aGlzKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuJHN0YWdlLmNzcyh7XG5cdFx0XHRcdGxlZnQ6IGNvb3JkaW5hdGUgKyAncHgnXG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIENoZWNrcyB3aGV0aGVyIHRoZSBjYXJvdXNlbCBpcyBpbiBhIHNwZWNpZmljIHN0YXRlIG9yIG5vdC5cblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0YXRlIC0gVGhlIHN0YXRlIHRvIGNoZWNrLlxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBUaGUgZmxhZyB3aGljaCBpbmRpY2F0ZXMgaWYgdGhlIGNhcm91c2VsIGlzIGJ1c3kuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmlzID0gZnVuY3Rpb24oc3RhdGUpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdGVzLmN1cnJlbnRbc3RhdGVdICYmIHRoaXMuX3N0YXRlcy5jdXJyZW50W3N0YXRlXSA+IDA7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjdXJyZW50IGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgbmV3IGFic29sdXRlIHBvc2l0aW9uIG9yIG5vdGhpbmcgdG8gbGVhdmUgaXQgdW5jaGFuZ2VkLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSBhYnNvbHV0ZSBwb3NpdGlvbiBvZiB0aGUgY3VycmVudCBpdGVtLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2l0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRwb3NpdGlvbiA9IHRoaXMubm9ybWFsaXplKHBvc2l0aW9uKTtcblxuXHRcdGlmICh0aGlzLl9jdXJyZW50ICE9PSBwb3NpdGlvbikge1xuXHRcdFx0dmFyIGV2ZW50ID0gdGhpcy50cmlnZ2VyKCdjaGFuZ2UnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdwb3NpdGlvbicsIHZhbHVlOiBwb3NpdGlvbiB9IH0pO1xuXG5cdFx0XHRpZiAoZXZlbnQuZGF0YSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUoZXZlbnQuZGF0YSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2N1cnJlbnQgPSBwb3NpdGlvbjtcblxuXHRcdFx0dGhpcy5pbnZhbGlkYXRlKCdwb3NpdGlvbicpO1xuXG5cdFx0XHR0aGlzLnRyaWdnZXIoJ2NoYW5nZWQnLCB7IHByb3BlcnR5OiB7IG5hbWU6ICdwb3NpdGlvbicsIHZhbHVlOiB0aGlzLl9jdXJyZW50IH0gfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnQ7XG5cdH07XG5cblx0LyoqXG5cdCAqIEludmFsaWRhdGVzIHRoZSBnaXZlbiBwYXJ0IG9mIHRoZSB1cGRhdGUgcm91dGluZS5cblx0ICogQHBhcmFtIHtTdHJpbmd9IFtwYXJ0XSAtIFRoZSBwYXJ0IHRvIGludmFsaWRhdGUuXG5cdCAqIEByZXR1cm5zIHtBcnJheS48U3RyaW5nPn0gLSBUaGUgaW52YWxpZGF0ZWQgcGFydHMuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmludmFsaWRhdGUgPSBmdW5jdGlvbihwYXJ0KSB7XG5cdFx0aWYgKCQudHlwZShwYXJ0KSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuX2ludmFsaWRhdGVkW3BhcnRdID0gdHJ1ZTtcblx0XHRcdHRoaXMuaXMoJ3ZhbGlkJykgJiYgdGhpcy5sZWF2ZSgndmFsaWQnKTtcblx0XHR9XG5cdFx0cmV0dXJuICQubWFwKHRoaXMuX2ludmFsaWRhdGVkLCBmdW5jdGlvbih2LCBpKSB7IHJldHVybiBpIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZXNldHMgdGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBjdXJyZW50IGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBuZXcgaXRlbS5cblx0ICovXG5cdE93bC5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuXHRcdHBvc2l0aW9uID0gdGhpcy5ub3JtYWxpemUocG9zaXRpb24pO1xuXG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9zcGVlZCA9IDA7XG5cdFx0dGhpcy5fY3VycmVudCA9IHBvc2l0aW9uO1xuXG5cdFx0dGhpcy5zdXBwcmVzcyhbICd0cmFuc2xhdGUnLCAndHJhbnNsYXRlZCcgXSk7XG5cblx0XHR0aGlzLmFuaW1hdGUodGhpcy5jb29yZGluYXRlcyhwb3NpdGlvbikpO1xuXG5cdFx0dGhpcy5yZWxlYXNlKFsgJ3RyYW5zbGF0ZScsICd0cmFuc2xhdGVkJyBdKTtcblx0fTtcblxuXHQvKipcblx0ICogTm9ybWFsaXplcyBhbiBhYnNvbHV0ZSBvciBhIHJlbGF0aXZlIHBvc2l0aW9uIG9mIGFuIGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIG9yIHJlbGF0aXZlIHBvc2l0aW9uIHRvIG5vcm1hbGl6ZS5cblx0ICogQHBhcmFtIHtCb29sZWFufSBbcmVsYXRpdmU9ZmFsc2VdIC0gV2hldGhlciB0aGUgZ2l2ZW4gcG9zaXRpb24gaXMgcmVsYXRpdmUgb3Igbm90LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSAtIFRoZSBub3JtYWxpemVkIHBvc2l0aW9uLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbihwb3NpdGlvbiwgcmVsYXRpdmUpIHtcblx0XHR2YXIgbiA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcblx0XHRcdG0gPSByZWxhdGl2ZSA/IDAgOiB0aGlzLl9jbG9uZXMubGVuZ3RoO1xuXG5cdFx0aWYgKCF0aGlzLmlzTnVtZXJpYyhwb3NpdGlvbikgfHwgbiA8IDEpIHtcblx0XHRcdHBvc2l0aW9uID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAocG9zaXRpb24gPCAwIHx8IHBvc2l0aW9uID49IG4gKyBtKSB7XG5cdFx0XHRwb3NpdGlvbiA9ICgocG9zaXRpb24gLSBtIC8gMikgJSBuICsgbikgJSBuICsgbSAvIDI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBvc2l0aW9uO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhbiBhYnNvbHV0ZSBwb3NpdGlvbiBvZiBhbiBpdGVtIGludG8gYSByZWxhdGl2ZSBvbmUuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIHRvIGNvbnZlcnQuXG5cdCAqIEByZXR1cm5zIHtOdW1iZXJ9IC0gVGhlIGNvbnZlcnRlZCBwb3NpdGlvbi5cblx0ICovXG5cdE93bC5wcm90b3R5cGUucmVsYXRpdmUgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuXHRcdHBvc2l0aW9uIC09IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyO1xuXHRcdHJldHVybiB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIG1heGltdW0gcG9zaXRpb24gZm9yIHRoZSBjdXJyZW50IGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtCb29sZWFufSBbcmVsYXRpdmU9ZmFsc2VdIC0gV2hldGhlciB0byByZXR1cm4gYW4gYWJzb2x1dGUgcG9zaXRpb24gb3IgYSByZWxhdGl2ZSBwb3NpdGlvbi5cblx0ICogQHJldHVybnMge051bWJlcn1cblx0ICovXG5cdE93bC5wcm90b3R5cGUubWF4aW11bSA9IGZ1bmN0aW9uKHJlbGF0aXZlKSB7XG5cdFx0dmFyIHNldHRpbmdzID0gdGhpcy5zZXR0aW5ncyxcblx0XHRcdG1heGltdW0gPSB0aGlzLl9jb29yZGluYXRlcy5sZW5ndGgsXG5cdFx0XHRpdGVyYXRvcixcblx0XHRcdHJlY2lwcm9jYWxJdGVtc1dpZHRoLFxuXHRcdFx0ZWxlbWVudFdpZHRoO1xuXG5cdFx0aWYgKHNldHRpbmdzLmxvb3ApIHtcblx0XHRcdG1heGltdW0gPSB0aGlzLl9jbG9uZXMubGVuZ3RoIC8gMiArIHRoaXMuX2l0ZW1zLmxlbmd0aCAtIDE7XG5cdFx0fSBlbHNlIGlmIChzZXR0aW5ncy5hdXRvV2lkdGggfHwgc2V0dGluZ3MubWVyZ2UpIHtcblx0XHRcdGl0ZXJhdG9yID0gdGhpcy5faXRlbXMubGVuZ3RoO1xuXHRcdFx0aWYgKGl0ZXJhdG9yKSB7XG5cdFx0XHRcdHJlY2lwcm9jYWxJdGVtc1dpZHRoID0gdGhpcy5faXRlbXNbLS1pdGVyYXRvcl0ud2lkdGgoKTtcblx0XHRcdFx0ZWxlbWVudFdpZHRoID0gdGhpcy4kZWxlbWVudC53aWR0aCgpO1xuXHRcdFx0XHR3aGlsZSAoaXRlcmF0b3ItLSkge1xuXHRcdFx0XHRcdHJlY2lwcm9jYWxJdGVtc1dpZHRoICs9IHRoaXMuX2l0ZW1zW2l0ZXJhdG9yXS53aWR0aCgpICsgdGhpcy5zZXR0aW5ncy5tYXJnaW47XG5cdFx0XHRcdFx0aWYgKHJlY2lwcm9jYWxJdGVtc1dpZHRoID4gZWxlbWVudFdpZHRoKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG1heGltdW0gPSBpdGVyYXRvciArIDE7XG5cdFx0fSBlbHNlIGlmIChzZXR0aW5ncy5jZW50ZXIpIHtcblx0XHRcdG1heGltdW0gPSB0aGlzLl9pdGVtcy5sZW5ndGggLSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtYXhpbXVtID0gdGhpcy5faXRlbXMubGVuZ3RoIC0gc2V0dGluZ3MuaXRlbXM7XG5cdFx0fVxuXG5cdFx0aWYgKHJlbGF0aXZlKSB7XG5cdFx0XHRtYXhpbXVtIC09IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyO1xuXHRcdH1cblxuXHRcdHJldHVybiBNYXRoLm1heChtYXhpbXVtLCAwKTtcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgbWluaW11bSBwb3NpdGlvbiBmb3IgdGhlIGN1cnJlbnQgaXRlbS5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtyZWxhdGl2ZT1mYWxzZV0gLSBXaGV0aGVyIHRvIHJldHVybiBhbiBhYnNvbHV0ZSBwb3NpdGlvbiBvciBhIHJlbGF0aXZlIHBvc2l0aW9uLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfVxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5taW5pbXVtID0gZnVuY3Rpb24ocmVsYXRpdmUpIHtcblx0XHRyZXR1cm4gcmVsYXRpdmUgPyAwIDogdGhpcy5fY2xvbmVzLmxlbmd0aCAvIDI7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgYW4gaXRlbSBhdCB0aGUgc3BlY2lmaWVkIHJlbGF0aXZlIHBvc2l0aW9uLlxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxuXHQgKiBAcmV0dXJuIHtqUXVlcnl8QXJyYXkuPGpRdWVyeT59IC0gVGhlIGl0ZW0gYXQgdGhlIGdpdmVuIHBvc2l0aW9uIG9yIGFsbCBpdGVtcyBpZiBubyBwb3NpdGlvbiB3YXMgZ2l2ZW4uXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLml0ZW1zID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2l0ZW1zLnNsaWNlKCk7XG5cdFx0fVxuXG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXTtcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyBhbiBpdGVtIGF0IHRoZSBzcGVjaWZpZWQgcmVsYXRpdmUgcG9zaXRpb24uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXG5cdCAqIEByZXR1cm4ge2pRdWVyeXxBcnJheS48alF1ZXJ5Pn0gLSBUaGUgaXRlbSBhdCB0aGUgZ2l2ZW4gcG9zaXRpb24gb3IgYWxsIGl0ZW1zIGlmIG5vIHBvc2l0aW9uIHdhcyBnaXZlbi5cblx0ICovXG5cdE93bC5wcm90b3R5cGUubWVyZ2VycyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG5cdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9tZXJnZXJzLnNsaWNlKCk7XG5cdFx0fVxuXG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XG5cdFx0cmV0dXJuIHRoaXMuX21lcmdlcnNbcG9zaXRpb25dO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBhYnNvbHV0ZSBwb3NpdGlvbnMgb2YgY2xvbmVzIGZvciBhbiBpdGVtLlxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbcG9zaXRpb25dIC0gVGhlIHJlbGF0aXZlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxuXHQgKiBAcmV0dXJucyB7QXJyYXkuPE51bWJlcj59IC0gVGhlIGFic29sdXRlIHBvc2l0aW9ucyBvZiBjbG9uZXMgZm9yIHRoZSBpdGVtIG9yIGFsbCBpZiBubyBwb3NpdGlvbiB3YXMgZ2l2ZW4uXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmNsb25lcyA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG5cdFx0dmFyIG9kZCA9IHRoaXMuX2Nsb25lcy5sZW5ndGggLyAyLFxuXHRcdFx0ZXZlbiA9IG9kZCArIHRoaXMuX2l0ZW1zLmxlbmd0aCxcblx0XHRcdG1hcCA9IGZ1bmN0aW9uKGluZGV4KSB7IHJldHVybiBpbmRleCAlIDIgPT09IDAgPyBldmVuICsgaW5kZXggLyAyIDogb2RkIC0gKGluZGV4ICsgMSkgLyAyIH07XG5cblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuICQubWFwKHRoaXMuX2Nsb25lcywgZnVuY3Rpb24odiwgaSkgeyByZXR1cm4gbWFwKGkpIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiAkLm1hcCh0aGlzLl9jbG9uZXMsIGZ1bmN0aW9uKHYsIGkpIHsgcmV0dXJuIHYgPT09IHBvc2l0aW9uID8gbWFwKGkpIDogbnVsbCB9KTtcblx0fTtcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY3VycmVudCBhbmltYXRpb24gc3BlZWQuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgYW5pbWF0aW9uIHNwZWVkIGluIG1pbGxpc2Vjb25kcyBvciBub3RoaW5nIHRvIGxlYXZlIGl0IHVuY2hhbmdlZC5cblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgY3VycmVudCBhbmltYXRpb24gc3BlZWQgaW4gbWlsbGlzZWNvbmRzLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5zcGVlZCA9IGZ1bmN0aW9uKHNwZWVkKSB7XG5cdFx0aWYgKHNwZWVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3NwZWVkID0gc3BlZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3NwZWVkO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBHZXRzIHRoZSBjb29yZGluYXRlIG9mIGFuIGl0ZW0uXG5cdCAqIEB0b2RvIFRoZSBuYW1lIG9mIHRoaXMgbWV0aG9kIGlzIG1pc3NsZWFuZGluZy5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0gd2l0aGluIGBtaW5pbXVtKClgIGFuZCBgbWF4aW11bSgpYC5cblx0ICogQHJldHVybnMge051bWJlcnxBcnJheS48TnVtYmVyPn0gLSBUaGUgY29vcmRpbmF0ZSBvZiB0aGUgaXRlbSBpbiBwaXhlbCBvciBhbGwgY29vcmRpbmF0ZXMuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmNvb3JkaW5hdGVzID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcblx0XHR2YXIgbXVsdGlwbGllciA9IDEsXG5cdFx0XHRuZXdQb3NpdGlvbiA9IHBvc2l0aW9uIC0gMSxcblx0XHRcdGNvb3JkaW5hdGU7XG5cblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuICQubWFwKHRoaXMuX2Nvb3JkaW5hdGVzLCAkLnByb3h5KGZ1bmN0aW9uKGNvb3JkaW5hdGUsIGluZGV4KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmNvb3JkaW5hdGVzKGluZGV4KTtcblx0XHRcdH0sIHRoaXMpKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5jZW50ZXIpIHtcblx0XHRcdGlmICh0aGlzLnNldHRpbmdzLnJ0bCkge1xuXHRcdFx0XHRtdWx0aXBsaWVyID0gLTE7XG5cdFx0XHRcdG5ld1Bvc2l0aW9uID0gcG9zaXRpb24gKyAxO1xuXHRcdFx0fVxuXG5cdFx0XHRjb29yZGluYXRlID0gdGhpcy5fY29vcmRpbmF0ZXNbcG9zaXRpb25dO1xuXHRcdFx0Y29vcmRpbmF0ZSArPSAodGhpcy53aWR0aCgpIC0gY29vcmRpbmF0ZSArICh0aGlzLl9jb29yZGluYXRlc1tuZXdQb3NpdGlvbl0gfHwgMCkpIC8gMiAqIG11bHRpcGxpZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvb3JkaW5hdGUgPSB0aGlzLl9jb29yZGluYXRlc1tuZXdQb3NpdGlvbl0gfHwgMDtcblx0XHR9XG5cblx0XHRjb29yZGluYXRlID0gTWF0aC5jZWlsKGNvb3JkaW5hdGUpO1xuXG5cdFx0cmV0dXJuIGNvb3JkaW5hdGU7XG5cdH07XG5cblx0LyoqXG5cdCAqIENhbGN1bGF0ZXMgdGhlIHNwZWVkIGZvciBhIHRyYW5zbGF0aW9uLlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBmcm9tIC0gVGhlIGFic29sdXRlIHBvc2l0aW9uIG9mIHRoZSBzdGFydCBpdGVtLlxuXHQgKiBAcGFyYW0ge051bWJlcn0gdG8gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIHRhcmdldCBpdGVtLlxuXHQgKiBAcGFyYW0ge051bWJlcn0gW2ZhY3Rvcj11bmRlZmluZWRdIC0gVGhlIHRpbWUgZmFjdG9yIGluIG1pbGxpc2Vjb25kcy5cblx0ICogQHJldHVybnMge051bWJlcn0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2xhdGlvbi5cblx0ICovXG5cdE93bC5wcm90b3R5cGUuZHVyYXRpb24gPSBmdW5jdGlvbihmcm9tLCB0bywgZmFjdG9yKSB7XG5cdFx0aWYgKGZhY3RvciA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgubWluKE1hdGgubWF4KE1hdGguYWJzKHRvIC0gZnJvbSksIDEpLCA2KSAqIE1hdGguYWJzKChmYWN0b3IgfHwgdGhpcy5zZXR0aW5ncy5zbWFydFNwZWVkKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNsaWRlcyB0byB0aGUgc3BlY2lmaWVkIGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBpdGVtLlxuXHQgKiBAcGFyYW0ge051bWJlcn0gW3NwZWVkXSAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBmb3IgdGhlIHRyYW5zaXRpb24uXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLnRvID0gZnVuY3Rpb24ocG9zaXRpb24sIHNwZWVkKSB7XG5cdFx0dmFyIGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQoKSxcblx0XHRcdHJldmVydCA9IG51bGwsXG5cdFx0XHRkaXN0YW5jZSA9IHBvc2l0aW9uIC0gdGhpcy5yZWxhdGl2ZShjdXJyZW50KSxcblx0XHRcdGRpcmVjdGlvbiA9IChkaXN0YW5jZSA+IDApIC0gKGRpc3RhbmNlIDwgMCksXG5cdFx0XHRpdGVtcyA9IHRoaXMuX2l0ZW1zLmxlbmd0aCxcblx0XHRcdG1pbmltdW0gPSB0aGlzLm1pbmltdW0oKSxcblx0XHRcdG1heGltdW0gPSB0aGlzLm1heGltdW0oKTtcblxuXHRcdGlmICh0aGlzLnNldHRpbmdzLmxvb3ApIHtcblx0XHRcdGlmICghdGhpcy5zZXR0aW5ncy5yZXdpbmQgJiYgTWF0aC5hYnMoZGlzdGFuY2UpID4gaXRlbXMgLyAyKSB7XG5cdFx0XHRcdGRpc3RhbmNlICs9IGRpcmVjdGlvbiAqIC0xICogaXRlbXM7XG5cdFx0XHR9XG5cblx0XHRcdHBvc2l0aW9uID0gY3VycmVudCArIGRpc3RhbmNlO1xuXHRcdFx0cmV2ZXJ0ID0gKChwb3NpdGlvbiAtIG1pbmltdW0pICUgaXRlbXMgKyBpdGVtcykgJSBpdGVtcyArIG1pbmltdW07XG5cblx0XHRcdGlmIChyZXZlcnQgIT09IHBvc2l0aW9uICYmIHJldmVydCAtIGRpc3RhbmNlIDw9IG1heGltdW0gJiYgcmV2ZXJ0IC0gZGlzdGFuY2UgPiAwKSB7XG5cdFx0XHRcdGN1cnJlbnQgPSByZXZlcnQgLSBkaXN0YW5jZTtcblx0XHRcdFx0cG9zaXRpb24gPSByZXZlcnQ7XG5cdFx0XHRcdHRoaXMucmVzZXQoY3VycmVudCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLnNldHRpbmdzLnJld2luZCkge1xuXHRcdFx0bWF4aW11bSArPSAxO1xuXHRcdFx0cG9zaXRpb24gPSAocG9zaXRpb24gJSBtYXhpbXVtICsgbWF4aW11bSkgJSBtYXhpbXVtO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwb3NpdGlvbiA9IE1hdGgubWF4KG1pbmltdW0sIE1hdGgubWluKG1heGltdW0sIHBvc2l0aW9uKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5zcGVlZCh0aGlzLmR1cmF0aW9uKGN1cnJlbnQsIHBvc2l0aW9uLCBzcGVlZCkpO1xuXHRcdHRoaXMuY3VycmVudChwb3NpdGlvbik7XG5cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIFNsaWRlcyB0byB0aGUgbmV4dCBpdGVtLlxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZvciB0aGUgdHJhbnNpdGlvbi5cblx0ICovXG5cdE93bC5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKHNwZWVkKSB7XG5cdFx0c3BlZWQgPSBzcGVlZCB8fCBmYWxzZTtcblx0XHR0aGlzLnRvKHRoaXMucmVsYXRpdmUodGhpcy5jdXJyZW50KCkpICsgMSwgc3BlZWQpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTbGlkZXMgdG8gdGhlIHByZXZpb3VzIGl0ZW0uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5wcmV2ID0gZnVuY3Rpb24oc3BlZWQpIHtcblx0XHRzcGVlZCA9IHNwZWVkIHx8IGZhbHNlO1xuXHRcdHRoaXMudG8odGhpcy5yZWxhdGl2ZSh0aGlzLmN1cnJlbnQoKSkgLSAxLCBzcGVlZCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEhhbmRsZXMgdGhlIGVuZCBvZiBhbiBhbmltYXRpb24uXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5vblRyYW5zaXRpb25FbmQgPSBmdW5jdGlvbihldmVudCkge1xuXG5cdFx0Ly8gaWYgY3NzMiBhbmltYXRpb24gdGhlbiBldmVudCBvYmplY3QgaXMgdW5kZWZpbmVkXG5cdFx0aWYgKGV2ZW50ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHQvLyBDYXRjaCBvbmx5IG93bC1zdGFnZSB0cmFuc2l0aW9uRW5kIGV2ZW50XG5cdFx0XHRpZiAoKGV2ZW50LnRhcmdldCB8fCBldmVudC5zcmNFbGVtZW50IHx8IGV2ZW50Lm9yaWdpbmFsVGFyZ2V0KSAhPT0gdGhpcy4kc3RhZ2UuZ2V0KDApKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLmxlYXZlKCdhbmltYXRpbmcnKTtcblx0XHR0aGlzLnRyaWdnZXIoJ3RyYW5zbGF0ZWQnKTtcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyB2aWV3cG9ydCB3aWR0aC5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IC0gVGhlIHdpZHRoIGluIHBpeGVsLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS52aWV3cG9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciB3aWR0aDtcblx0XHRpZiAodGhpcy5vcHRpb25zLnJlc3BvbnNpdmVCYXNlRWxlbWVudCAhPT0gd2luZG93KSB7XG5cdFx0XHR3aWR0aCA9ICQodGhpcy5vcHRpb25zLnJlc3BvbnNpdmVCYXNlRWxlbWVudCkud2lkdGgoKTtcblx0XHR9IGVsc2UgaWYgKHdpbmRvdy5pbm5lcldpZHRoKSB7XG5cdFx0XHR3aWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuXHRcdH0gZWxzZSBpZiAoZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCkge1xuXHRcdFx0d2lkdGggPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUud2FybignQ2FuIG5vdCBkZXRlY3Qgdmlld3BvcnQgd2lkdGguJyk7XG5cdFx0fVxuXHRcdHJldHVybiB3aWR0aDtcblx0fTtcblxuXHQvKipcblx0ICogUmVwbGFjZXMgdGhlIGN1cnJlbnQgY29udGVudC5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeXxTdHJpbmd9IGNvbnRlbnQgLSBUaGUgbmV3IGNvbnRlbnQuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLnJlcGxhY2UgPSBmdW5jdGlvbihjb250ZW50KSB7XG5cdFx0dGhpcy4kc3RhZ2UuZW1wdHkoKTtcblx0XHR0aGlzLl9pdGVtcyA9IFtdO1xuXG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdGNvbnRlbnQgPSAoY29udGVudCBpbnN0YW5jZW9mIGpRdWVyeSkgPyBjb250ZW50IDogJChjb250ZW50KTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IpIHtcblx0XHRcdGNvbnRlbnQgPSBjb250ZW50LmZpbmQoJy4nICsgdGhpcy5zZXR0aW5ncy5uZXN0ZWRJdGVtU2VsZWN0b3IpO1xuXHRcdH1cblxuXHRcdGNvbnRlbnQuZmlsdGVyKGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMubm9kZVR5cGUgPT09IDE7XG5cdFx0fSkuZWFjaCgkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBpdGVtKSB7XG5cdFx0XHRpdGVtID0gdGhpcy5wcmVwYXJlKGl0ZW0pO1xuXHRcdFx0dGhpcy4kc3RhZ2UuYXBwZW5kKGl0ZW0pO1xuXHRcdFx0dGhpcy5faXRlbXMucHVzaChpdGVtKTtcblx0XHRcdHRoaXMuX21lcmdlcnMucHVzaChpdGVtLmZpbmQoJ1tkYXRhLW1lcmdlXScpLmFkZEJhY2soJ1tkYXRhLW1lcmdlXScpLmF0dHIoJ2RhdGEtbWVyZ2UnKSAqIDEgfHwgMSk7XG5cdFx0fSwgdGhpcykpO1xuXG5cdFx0dGhpcy5yZXNldCh0aGlzLmlzTnVtZXJpYyh0aGlzLnNldHRpbmdzLnN0YXJ0UG9zaXRpb24pID8gdGhpcy5zZXR0aW5ncy5zdGFydFBvc2l0aW9uIDogMCk7XG5cblx0XHR0aGlzLmludmFsaWRhdGUoJ2l0ZW1zJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEFkZHMgYW4gaXRlbS5cblx0ICogQHRvZG8gVXNlIGBpdGVtYCBpbnN0ZWFkIG9mIGBjb250ZW50YCBmb3IgdGhlIGV2ZW50IGFyZ3VtZW50cy5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fGpRdWVyeXxTdHJpbmd9IGNvbnRlbnQgLSBUaGUgaXRlbSBjb250ZW50IHRvIGFkZC5cblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtwb3NpdGlvbl0gLSBUaGUgcmVsYXRpdmUgcG9zaXRpb24gYXQgd2hpY2ggdG8gaW5zZXJ0IHRoZSBpdGVtIG90aGVyd2lzZSB0aGUgaXRlbSB3aWxsIGJlIGFkZGVkIHRvIHRoZSBlbmQuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKGNvbnRlbnQsIHBvc2l0aW9uKSB7XG5cdFx0dmFyIGN1cnJlbnQgPSB0aGlzLnJlbGF0aXZlKHRoaXMuX2N1cnJlbnQpO1xuXG5cdFx0cG9zaXRpb24gPSBwb3NpdGlvbiA9PT0gdW5kZWZpbmVkID8gdGhpcy5faXRlbXMubGVuZ3RoIDogdGhpcy5ub3JtYWxpemUocG9zaXRpb24sIHRydWUpO1xuXHRcdGNvbnRlbnQgPSBjb250ZW50IGluc3RhbmNlb2YgalF1ZXJ5ID8gY29udGVudCA6ICQoY29udGVudCk7XG5cblx0XHR0aGlzLnRyaWdnZXIoJ2FkZCcsIHsgY29udGVudDogY29udGVudCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xuXG5cdFx0Y29udGVudCA9IHRoaXMucHJlcGFyZShjb250ZW50KTtcblxuXHRcdGlmICh0aGlzLl9pdGVtcy5sZW5ndGggPT09IDAgfHwgcG9zaXRpb24gPT09IHRoaXMuX2l0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5faXRlbXMubGVuZ3RoID09PSAwICYmIHRoaXMuJHN0YWdlLmFwcGVuZChjb250ZW50KTtcblx0XHRcdHRoaXMuX2l0ZW1zLmxlbmd0aCAhPT0gMCAmJiB0aGlzLl9pdGVtc1twb3NpdGlvbiAtIDFdLmFmdGVyKGNvbnRlbnQpO1xuXHRcdFx0dGhpcy5faXRlbXMucHVzaChjb250ZW50KTtcblx0XHRcdHRoaXMuX21lcmdlcnMucHVzaChjb250ZW50LmZpbmQoJ1tkYXRhLW1lcmdlXScpLmFkZEJhY2soJ1tkYXRhLW1lcmdlXScpLmF0dHIoJ2RhdGEtbWVyZ2UnKSAqIDEgfHwgMSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXS5iZWZvcmUoY29udGVudCk7XG5cdFx0XHR0aGlzLl9pdGVtcy5zcGxpY2UocG9zaXRpb24sIDAsIGNvbnRlbnQpO1xuXHRcdFx0dGhpcy5fbWVyZ2Vycy5zcGxpY2UocG9zaXRpb24sIDAsIGNvbnRlbnQuZmluZCgnW2RhdGEtbWVyZ2VdJykuYWRkQmFjaygnW2RhdGEtbWVyZ2VdJykuYXR0cignZGF0YS1tZXJnZScpICogMSB8fCAxKTtcblx0XHR9XG5cblx0XHR0aGlzLl9pdGVtc1tjdXJyZW50XSAmJiB0aGlzLnJlc2V0KHRoaXMuX2l0ZW1zW2N1cnJlbnRdLmluZGV4KCkpO1xuXG5cdFx0dGhpcy5pbnZhbGlkYXRlKCdpdGVtcycpO1xuXG5cdFx0dGhpcy50cmlnZ2VyKCdhZGRlZCcsIHsgY29udGVudDogY29udGVudCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGFuIGl0ZW0gYnkgaXRzIHBvc2l0aW9uLlxuXHQgKiBAdG9kbyBVc2UgYGl0ZW1gIGluc3RlYWQgb2YgYGNvbnRlbnRgIGZvciB0aGUgZXZlbnQgYXJndW1lbnRzLlxuXHQgKiBAcHVibGljXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBwb3NpdGlvbiAtIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBvZiB0aGUgaXRlbSB0byByZW1vdmUuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG5cdFx0cG9zaXRpb24gPSB0aGlzLm5vcm1hbGl6ZShwb3NpdGlvbiwgdHJ1ZSk7XG5cblx0XHRpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudHJpZ2dlcigncmVtb3ZlJywgeyBjb250ZW50OiB0aGlzLl9pdGVtc1twb3NpdGlvbl0sIHBvc2l0aW9uOiBwb3NpdGlvbiB9KTtcblxuXHRcdHRoaXMuX2l0ZW1zW3Bvc2l0aW9uXS5yZW1vdmUoKTtcblx0XHR0aGlzLl9pdGVtcy5zcGxpY2UocG9zaXRpb24sIDEpO1xuXHRcdHRoaXMuX21lcmdlcnMuc3BsaWNlKHBvc2l0aW9uLCAxKTtcblxuXHRcdHRoaXMuaW52YWxpZGF0ZSgnaXRlbXMnKTtcblxuXHRcdHRoaXMudHJpZ2dlcigncmVtb3ZlZCcsIHsgY29udGVudDogbnVsbCwgcG9zaXRpb246IHBvc2l0aW9uIH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBQcmVsb2FkcyBpbWFnZXMgd2l0aCBhdXRvIHdpZHRoLlxuXHQgKiBAdG9kbyBSZXBsYWNlIGJ5IGEgbW9yZSBnZW5lcmljIGFwcHJvYWNoXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE93bC5wcm90b3R5cGUucHJlbG9hZEF1dG9XaWR0aEltYWdlcyA9IGZ1bmN0aW9uKGltYWdlcykge1xuXHRcdGltYWdlcy5lYWNoKCQucHJveHkoZnVuY3Rpb24oaSwgZWxlbWVudCkge1xuXHRcdFx0dGhpcy5lbnRlcigncHJlLWxvYWRpbmcnKTtcblx0XHRcdGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xuXHRcdFx0JChuZXcgSW1hZ2UoKSkub25lKCdsb2FkJywgJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGVsZW1lbnQuYXR0cignc3JjJywgZS50YXJnZXQuc3JjKTtcblx0XHRcdFx0ZWxlbWVudC5jc3MoJ29wYWNpdHknLCAxKTtcblx0XHRcdFx0dGhpcy5sZWF2ZSgncHJlLWxvYWRpbmcnKTtcblx0XHRcdFx0IXRoaXMuaXMoJ3ByZS1sb2FkaW5nJykgJiYgIXRoaXMuaXMoJ2luaXRpYWxpemluZycpICYmIHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0fSwgdGhpcykpLmF0dHIoJ3NyYycsIGVsZW1lbnQuYXR0cignc3JjJykgfHwgZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpIHx8IGVsZW1lbnQuYXR0cignZGF0YS1zcmMtcmV0aW5hJykpO1xuXHRcdH0sIHRoaXMpKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIGNhcm91c2VsLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcblxuXHRcdHRoaXMuJGVsZW1lbnQub2ZmKCcub3dsLmNvcmUnKTtcblx0XHR0aGlzLiRzdGFnZS5vZmYoJy5vd2wuY29yZScpO1xuXHRcdCQoZG9jdW1lbnQpLm9mZignLm93bC5jb3JlJyk7XG5cblx0XHRpZiAodGhpcy5zZXR0aW5ncy5yZXNwb25zaXZlICE9PSBmYWxzZSkge1xuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJlc2l6ZVRpbWVyKTtcblx0XHRcdHRoaXMub2ZmKHdpbmRvdywgJ3Jlc2l6ZScsIHRoaXMuX2hhbmRsZXJzLm9uVGhyb3R0bGVkUmVzaXplKTtcblx0XHR9XG5cblx0XHRmb3IgKHZhciBpIGluIHRoaXMuX3BsdWdpbnMpIHtcblx0XHRcdHRoaXMuX3BsdWdpbnNbaV0uZGVzdHJveSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuJHN0YWdlLmNoaWxkcmVuKCcuY2xvbmVkJykucmVtb3ZlKCk7XG5cblx0XHR0aGlzLiRzdGFnZS51bndyYXAoKTtcblx0XHR0aGlzLiRzdGFnZS5jaGlsZHJlbigpLmNvbnRlbnRzKCkudW53cmFwKCk7XG5cdFx0dGhpcy4kc3RhZ2UuY2hpbGRyZW4oKS51bndyYXAoKTtcblx0XHR0aGlzLiRzdGFnZS5yZW1vdmUoKTtcblx0XHR0aGlzLiRlbGVtZW50XG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLnJlZnJlc2hDbGFzcylcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMubG9hZGluZ0NsYXNzKVxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMub3B0aW9ucy5sb2FkZWRDbGFzcylcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMucnRsQ2xhc3MpXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5vcHRpb25zLmRyYWdDbGFzcylcblx0XHRcdC5yZW1vdmVDbGFzcyh0aGlzLm9wdGlvbnMuZ3JhYkNsYXNzKVxuXHRcdFx0LmF0dHIoJ2NsYXNzJywgdGhpcy4kZWxlbWVudC5hdHRyKCdjbGFzcycpLnJlcGxhY2UobmV3IFJlZ0V4cCh0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZUNsYXNzICsgJy1cXFxcUytcXFxccycsICdnJyksICcnKSlcblx0XHRcdC5yZW1vdmVEYXRhKCdvd2wuY2Fyb3VzZWwnKTtcblx0fTtcblxuXHQvKipcblx0ICogT3BlcmF0b3JzIHRvIGNhbGN1bGF0ZSByaWdodC10by1sZWZ0IGFuZCBsZWZ0LXRvLXJpZ2h0LlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbYV0gLSBUaGUgbGVmdCBzaWRlIG9wZXJhbmQuXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbb10gLSBUaGUgb3BlcmF0b3IuXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbYl0gLSBUaGUgcmlnaHQgc2lkZSBvcGVyYW5kLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5vcCA9IGZ1bmN0aW9uKGEsIG8sIGIpIHtcblx0XHR2YXIgcnRsID0gdGhpcy5zZXR0aW5ncy5ydGw7XG5cdFx0c3dpdGNoIChvKSB7XG5cdFx0XHRjYXNlICc8Jzpcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPiBiIDogYSA8IGI7XG5cdFx0XHRjYXNlICc+Jzpcblx0XHRcdFx0cmV0dXJuIHJ0bCA/IGEgPCBiIDogYSA+IGI7XG5cdFx0XHRjYXNlICc+PSc6XG5cdFx0XHRcdHJldHVybiBydGwgPyBhIDw9IGIgOiBhID49IGI7XG5cdFx0XHRjYXNlICc8PSc6XG5cdFx0XHRcdHJldHVybiBydGwgPyBhID49IGIgOiBhIDw9IGI7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIEF0dGFjaGVzIHRvIGFuIGludGVybmFsIGV2ZW50LlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1lbnQgLSBUaGUgZXZlbnQgc291cmNlLlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBUaGUgZXZlbnQgaGFuZGxlciB0byBhdHRhY2guXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gY2FwdHVyZSAtIFdldGhlciB0aGUgZXZlbnQgc2hvdWxkIGJlIGhhbmRsZWQgYXQgdGhlIGNhcHR1cmluZyBwaGFzZSBvciBub3QuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZWxlbWVudCwgZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKSB7XG5cdFx0aWYgKGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcikge1xuXHRcdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBsaXN0ZW5lciwgY2FwdHVyZSk7XG5cdFx0fSBlbHNlIGlmIChlbGVtZW50LmF0dGFjaEV2ZW50KSB7XG5cdFx0XHRlbGVtZW50LmF0dGFjaEV2ZW50KCdvbicgKyBldmVudCwgbGlzdGVuZXIpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogRGV0YWNoZXMgZnJvbSBhbiBpbnRlcm5hbCBldmVudC5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtZW50IC0gVGhlIGV2ZW50IHNvdXJjZS5cblx0ICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gVGhlIGF0dGFjaGVkIGV2ZW50IGhhbmRsZXIgdG8gZGV0YWNoLlxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IGNhcHR1cmUgLSBXZXRoZXIgdGhlIGF0dGFjaGVkIGV2ZW50IGhhbmRsZXIgd2FzIHJlZ2lzdGVyZWQgYXMgYSBjYXB0dXJpbmcgbGlzdGVuZXIgb3Igbm90LlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihlbGVtZW50LCBldmVudCwgbGlzdGVuZXIsIGNhcHR1cmUpIHtcblx0XHRpZiAoZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKSB7XG5cdFx0XHRlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBjYXB0dXJlKTtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuZGV0YWNoRXZlbnQpIHtcblx0XHRcdGVsZW1lbnQuZGV0YWNoRXZlbnQoJ29uJyArIGV2ZW50LCBsaXN0ZW5lcik7XG5cdFx0fVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBUcmlnZ2VycyBhIHB1YmxpYyBldmVudC5cblx0ICogQHRvZG8gUmVtb3ZlIGBzdGF0dXNgLCBgcmVsYXRlZFRhcmdldGAgc2hvdWxkIGJlIHVzZWQgaW5zdGVhZC5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAtIFRoZSBldmVudCBuYW1lLlxuXHQgKiBAcGFyYW0geyp9IFtkYXRhPW51bGxdIC0gVGhlIGV2ZW50IGRhdGEuXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbbmFtZXNwYWNlPWNhcm91c2VsXSAtIFRoZSBldmVudCBuYW1lc3BhY2UuXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBbc3RhdGVdIC0gVGhlIHN0YXRlIHdoaWNoIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGUgZXZlbnQuXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gW2VudGVyPWZhbHNlXSAtIEluZGljYXRlcyBpZiB0aGUgY2FsbCBlbnRlcnMgdGhlIHNwZWNpZmllZCBzdGF0ZSBvciBub3QuXG5cdCAqIEByZXR1cm5zIHtFdmVudH0gLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24obmFtZSwgZGF0YSwgbmFtZXNwYWNlLCBzdGF0ZSwgZW50ZXIpIHtcblx0XHR2YXIgc3RhdHVzID0ge1xuXHRcdFx0aXRlbTogeyBjb3VudDogdGhpcy5faXRlbXMubGVuZ3RoLCBpbmRleDogdGhpcy5jdXJyZW50KCkgfVxuXHRcdH0sIGhhbmRsZXIgPSAkLmNhbWVsQ2FzZShcblx0XHRcdCQuZ3JlcChbICdvbicsIG5hbWUsIG5hbWVzcGFjZSBdLCBmdW5jdGlvbih2KSB7IHJldHVybiB2IH0pXG5cdFx0XHRcdC5qb2luKCctJykudG9Mb3dlckNhc2UoKVxuXHRcdCksIGV2ZW50ID0gJC5FdmVudChcblx0XHRcdFsgbmFtZSwgJ293bCcsIG5hbWVzcGFjZSB8fCAnY2Fyb3VzZWwnIF0uam9pbignLicpLnRvTG93ZXJDYXNlKCksXG5cdFx0XHQkLmV4dGVuZCh7IHJlbGF0ZWRUYXJnZXQ6IHRoaXMgfSwgc3RhdHVzLCBkYXRhKVxuXHRcdCk7XG5cblx0XHRpZiAoIXRoaXMuX3N1cHJlc3NbbmFtZV0pIHtcblx0XHRcdCQuZWFjaCh0aGlzLl9wbHVnaW5zLCBmdW5jdGlvbihuYW1lLCBwbHVnaW4pIHtcblx0XHRcdFx0aWYgKHBsdWdpbi5vblRyaWdnZXIpIHtcblx0XHRcdFx0XHRwbHVnaW4ub25UcmlnZ2VyKGV2ZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMucmVnaXN0ZXIoeyB0eXBlOiBPd2wuVHlwZS5FdmVudCwgbmFtZTogbmFtZSB9KTtcblx0XHRcdHRoaXMuJGVsZW1lbnQudHJpZ2dlcihldmVudCk7XG5cblx0XHRcdGlmICh0aGlzLnNldHRpbmdzICYmIHR5cGVvZiB0aGlzLnNldHRpbmdzW2hhbmRsZXJdID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHRoaXMuc2V0dGluZ3NbaGFuZGxlcl0uY2FsbCh0aGlzLCBldmVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV2ZW50O1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBFbnRlcnMgYSBzdGF0ZS5cblx0ICogQHBhcmFtIG5hbWUgLSBUaGUgc3RhdGUgbmFtZS5cblx0ICovXG5cdE93bC5wcm90b3R5cGUuZW50ZXIgPSBmdW5jdGlvbihuYW1lKSB7XG5cdFx0JC5lYWNoKFsgbmFtZSBdLmNvbmNhdCh0aGlzLl9zdGF0ZXMudGFnc1tuYW1lXSB8fCBbXSksICQucHJveHkoZnVuY3Rpb24oaSwgbmFtZSkge1xuXHRcdFx0aWYgKHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fc3RhdGVzLmN1cnJlbnRbbmFtZV0gPSAwO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zdGF0ZXMuY3VycmVudFtuYW1lXSsrO1xuXHRcdH0sIHRoaXMpKTtcblx0fTtcblxuXHQvKipcblx0ICogTGVhdmVzIGEgc3RhdGUuXG5cdCAqIEBwYXJhbSBuYW1lIC0gVGhlIHN0YXRlIG5hbWUuXG5cdCAqL1xuXHRPd2wucHJvdG90eXBlLmxlYXZlID0gZnVuY3Rpb24obmFtZSkge1xuXHRcdCQuZWFjaChbIG5hbWUgXS5jb25jYXQodGhpcy5fc3RhdGVzLnRhZ3NbbmFtZV0gfHwgW10pLCAkLnByb3h5KGZ1bmN0aW9uKGksIG5hbWUpIHtcblx0XHRcdHRoaXMuX3N0YXRlcy5jdXJyZW50W25hbWVdLS07XG5cdFx0fSwgdGhpcykpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZWdpc3RlcnMgYW4gZXZlbnQgb3Igc3RhdGUuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCAtIFRoZSBldmVudCBvciBzdGF0ZSB0byByZWdpc3Rlci5cblx0ICovXG5cdE93bC5wcm90b3R5cGUucmVnaXN0ZXIgPSBmdW5jdGlvbihvYmplY3QpIHtcblx0XHRpZiAob2JqZWN0LnR5cGUgPT09IE93bC5UeXBlLkV2ZW50KSB7XG5cdFx0XHRpZiAoISQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0pIHtcblx0XHRcdFx0JC5ldmVudC5zcGVjaWFsW29iamVjdC5uYW1lXSA9IHt9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoISQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0ub3dsKSB7XG5cdFx0XHRcdHZhciBfZGVmYXVsdCA9ICQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0uX2RlZmF1bHQ7XG5cdFx0XHRcdCQuZXZlbnQuc3BlY2lhbFtvYmplY3QubmFtZV0uX2RlZmF1bHQgPSBmdW5jdGlvbihlKSB7XG5cdFx0XHRcdFx0aWYgKF9kZWZhdWx0ICYmIF9kZWZhdWx0LmFwcGx5ICYmICghZS5uYW1lc3BhY2UgfHwgZS5uYW1lc3BhY2UuaW5kZXhPZignb3dsJykgPT09IC0xKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIF9kZWZhdWx0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBlLm5hbWVzcGFjZSAmJiBlLm5hbWVzcGFjZS5pbmRleE9mKCdvd2wnKSA+IC0xO1xuXHRcdFx0XHR9O1xuXHRcdFx0XHQkLmV2ZW50LnNwZWNpYWxbb2JqZWN0Lm5hbWVdLm93bCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChvYmplY3QudHlwZSA9PT0gT3dsLlR5cGUuU3RhdGUpIHtcblx0XHRcdGlmICghdGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSA9IG9iamVjdC50YWdzO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdID0gdGhpcy5fc3RhdGVzLnRhZ3Nbb2JqZWN0Lm5hbWVdLmNvbmNhdChvYmplY3QudGFncyk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3N0YXRlcy50YWdzW29iamVjdC5uYW1lXSA9ICQuZ3JlcCh0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0sICQucHJveHkoZnVuY3Rpb24odGFnLCBpKSB7XG5cdFx0XHRcdHJldHVybiAkLmluQXJyYXkodGFnLCB0aGlzLl9zdGF0ZXMudGFnc1tvYmplY3QubmFtZV0pID09PSBpO1xuXHRcdFx0fSwgdGhpcykpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogU3VwcHJlc3NlcyBldmVudHMuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gZXZlbnRzIC0gVGhlIGV2ZW50cyB0byBzdXBwcmVzcy5cblx0ICovXG5cdE93bC5wcm90b3R5cGUuc3VwcHJlc3MgPSBmdW5jdGlvbihldmVudHMpIHtcblx0XHQkLmVhY2goZXZlbnRzLCAkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBldmVudCkge1xuXHRcdFx0dGhpcy5fc3VwcmVzc1tldmVudF0gPSB0cnVlO1xuXHRcdH0sIHRoaXMpKTtcblx0fTtcblxuXHQvKipcblx0ICogUmVsZWFzZXMgc3VwcHJlc3NlZCBldmVudHMuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHBhcmFtIHtBcnJheS48U3RyaW5nPn0gZXZlbnRzIC0gVGhlIGV2ZW50cyB0byByZWxlYXNlLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5yZWxlYXNlID0gZnVuY3Rpb24oZXZlbnRzKSB7XG5cdFx0JC5lYWNoKGV2ZW50cywgJC5wcm94eShmdW5jdGlvbihpbmRleCwgZXZlbnQpIHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9zdXByZXNzW2V2ZW50XTtcblx0XHR9LCB0aGlzKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdW5pZmllZCBwb2ludGVyIGNvb3JkaW5hdGVzIGZyb20gZXZlbnQuXG5cdCAqIEB0b2RvICMyNjFcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge0V2ZW50fSAtIFRoZSBgbW91c2Vkb3duYCBvciBgdG91Y2hzdGFydGAgZXZlbnQuXG5cdCAqIEByZXR1cm5zIHtPYmplY3R9IC0gQ29udGFpbnMgYHhgIGFuZCBgeWAgY29vcmRpbmF0ZXMgb2YgY3VycmVudCBwb2ludGVyIHBvc2l0aW9uLlxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5wb2ludGVyID0gZnVuY3Rpb24oZXZlbnQpIHtcblx0XHR2YXIgcmVzdWx0ID0geyB4OiBudWxsLCB5OiBudWxsIH07XG5cblx0XHRldmVudCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQgfHwgd2luZG93LmV2ZW50O1xuXG5cdFx0ZXZlbnQgPSBldmVudC50b3VjaGVzICYmIGV2ZW50LnRvdWNoZXMubGVuZ3RoID9cblx0XHRcdGV2ZW50LnRvdWNoZXNbMF0gOiBldmVudC5jaGFuZ2VkVG91Y2hlcyAmJiBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGggP1xuXHRcdFx0XHRldmVudC5jaGFuZ2VkVG91Y2hlc1swXSA6IGV2ZW50O1xuXG5cdFx0aWYgKGV2ZW50LnBhZ2VYKSB7XG5cdFx0XHRyZXN1bHQueCA9IGV2ZW50LnBhZ2VYO1xuXHRcdFx0cmVzdWx0LnkgPSBldmVudC5wYWdlWTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0LnggPSBldmVudC5jbGllbnRYO1xuXHRcdFx0cmVzdWx0LnkgPSBldmVudC5jbGllbnRZO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cblx0LyoqXG5cdCAqIERldGVybWluZXMgaWYgdGhlIGlucHV0IGlzIGEgTnVtYmVyIG9yIHNvbWV0aGluZyB0aGF0IGNhbiBiZSBjb2VyY2VkIHRvIGEgTnVtYmVyXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ8U3RyaW5nfE9iamVjdHxBcnJheXxCb29sZWFufFJlZ0V4cHxGdW5jdGlvbnxTeW1ib2x9IC0gVGhlIGlucHV0IHRvIGJlIHRlc3RlZFxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBBbiBpbmRpY2F0aW9uIGlmIHRoZSBpbnB1dCBpcyBhIE51bWJlciBvciBjYW4gYmUgY29lcmNlZCB0byBhIE51bWJlclxuXHQgKi9cblx0T3dsLnByb3RvdHlwZS5pc051bWVyaWMgPSBmdW5jdGlvbihudW1iZXIpIHtcblx0XHRyZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobnVtYmVyKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGRpZmZlcmVuY2Ugb2YgdHdvIHZlY3RvcnMuXG5cdCAqIEB0b2RvICMyNjFcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge09iamVjdH0gLSBUaGUgZmlyc3QgdmVjdG9yLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gLSBUaGUgc2Vjb25kIHZlY3Rvci5cblx0ICogQHJldHVybnMge09iamVjdH0gLSBUaGUgZGlmZmVyZW5jZS5cblx0ICovXG5cdE93bC5wcm90b3R5cGUuZGlmZmVyZW5jZSA9IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0eDogZmlyc3QueCAtIHNlY29uZC54LFxuXHRcdFx0eTogZmlyc3QueSAtIHNlY29uZC55XG5cdFx0fTtcblx0fTtcblxuXHQvKipcblx0ICogVGhlIGpRdWVyeSBQbHVnaW4gZm9yIHRoZSBPd2wgQ2Fyb3VzZWxcblx0ICogQHRvZG8gTmF2aWdhdGlvbiBwbHVnaW4gYG5leHRgIGFuZCBgcHJldmBcblx0ICogQHB1YmxpY1xuXHQgKi9cblx0JC5mbi5vd2xDYXJvdXNlbCA9IGZ1bmN0aW9uKG9wdGlvbikge1xuXHRcdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuXHRcdHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgJHRoaXMgPSAkKHRoaXMpLFxuXHRcdFx0XHRkYXRhID0gJHRoaXMuZGF0YSgnb3dsLmNhcm91c2VsJyk7XG5cblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRkYXRhID0gbmV3IE93bCh0aGlzLCB0eXBlb2Ygb3B0aW9uID09ICdvYmplY3QnICYmIG9wdGlvbik7XG5cdFx0XHRcdCR0aGlzLmRhdGEoJ293bC5jYXJvdXNlbCcsIGRhdGEpO1xuXG5cdFx0XHRcdCQuZWFjaChbXG5cdFx0XHRcdFx0J25leHQnLCAncHJldicsICd0bycsICdkZXN0cm95JywgJ3JlZnJlc2gnLCAncmVwbGFjZScsICdhZGQnLCAncmVtb3ZlJ1xuXHRcdFx0XHRdLCBmdW5jdGlvbihpLCBldmVudCkge1xuXHRcdFx0XHRcdGRhdGEucmVnaXN0ZXIoeyB0eXBlOiBPd2wuVHlwZS5FdmVudCwgbmFtZTogZXZlbnQgfSk7XG5cdFx0XHRcdFx0ZGF0YS4kZWxlbWVudC5vbihldmVudCArICcub3dsLmNhcm91c2VsLmNvcmUnLCAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnJlbGF0ZWRUYXJnZXQgIT09IHRoaXMpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5zdXBwcmVzcyhbIGV2ZW50IF0pO1xuXHRcdFx0XHRcdFx0XHRkYXRhW2V2ZW50XS5hcHBseSh0aGlzLCBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLnJlbGVhc2UoWyBldmVudCBdKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LCBkYXRhKSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJyAmJiBvcHRpb24uY2hhckF0KDApICE9PSAnXycpIHtcblx0XHRcdFx0ZGF0YVtvcHRpb25dLmFwcGx5KGRhdGEsIGFyZ3MpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBUaGUgY29uc3RydWN0b3IgZm9yIHRoZSBqUXVlcnkgUGx1Z2luXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IgPSBPd2w7XG5cbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcblxuLyoqXG4gKiBBdXRvUmVmcmVzaCBQbHVnaW5cbiAqIEB2ZXJzaW9uIDIuMy40XG4gKiBAYXV0aG9yIEFydHVzIEtvbGFub3dza2lcbiAqIEBhdXRob3IgRGF2aWQgRGV1dHNjaFxuICogQGxpY2Vuc2UgVGhlIE1JVCBMaWNlbnNlIChNSVQpXG4gKi9cbjsoZnVuY3Rpb24oJCwgd2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdGhlIGF1dG8gcmVmcmVzaCBwbHVnaW4uXG5cdCAqIEBjbGFzcyBUaGUgQXV0byBSZWZyZXNoIFBsdWdpblxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXG5cdCAqL1xuXHR2YXIgQXV0b1JlZnJlc2ggPSBmdW5jdGlvbihjYXJvdXNlbCkge1xuXHRcdC8qKlxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge093bH1cblx0XHQgKi9cblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIGludGVydmFsLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7bnVtYmVyfVxuXHRcdCAqL1xuXHRcdHRoaXMuX2ludGVydmFsID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgY3VycmVudGx5IHZpc2libGUgb3Igbm90LlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKi9cblx0XHR0aGlzLl92aXNpYmxlID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge09iamVjdH1cblx0XHQgKi9cblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b1JlZnJlc2gpIHtcblx0XHRcdFx0XHR0aGlzLndhdGNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpXG5cdFx0fTtcblxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgQXV0b1JlZnJlc2guRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XG5cblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdEF1dG9SZWZyZXNoLkRlZmF1bHRzID0ge1xuXHRcdGF1dG9SZWZyZXNoOiB0cnVlLFxuXHRcdGF1dG9SZWZyZXNoSW50ZXJ2YWw6IDUwMFxuXHR9O1xuXG5cdC8qKlxuXHQgKiBXYXRjaGVzIHRoZSBlbGVtZW50LlxuXHQgKi9cblx0QXV0b1JlZnJlc2gucHJvdG90eXBlLndhdGNoID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuX2ludGVydmFsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmlzaWJsZSA9IHRoaXMuX2NvcmUuaXNWaXNpYmxlKCk7XG5cdFx0dGhpcy5faW50ZXJ2YWwgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoJC5wcm94eSh0aGlzLnJlZnJlc2gsIHRoaXMpLCB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9SZWZyZXNoSW50ZXJ2YWwpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBSZWZyZXNoZXMgdGhlIGVsZW1lbnQuXG5cdCAqL1xuXHRBdXRvUmVmcmVzaC5wcm90b3R5cGUucmVmcmVzaCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLl9jb3JlLmlzVmlzaWJsZSgpID09PSB0aGlzLl92aXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmlzaWJsZSA9ICF0aGlzLl92aXNpYmxlO1xuXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC50b2dnbGVDbGFzcygnb3dsLWhpZGRlbicsICF0aGlzLl92aXNpYmxlKTtcblxuXHRcdHRoaXMuX3Zpc2libGUgJiYgKHRoaXMuX2NvcmUuaW52YWxpZGF0ZSgnd2lkdGgnKSAmJiB0aGlzLl9jb3JlLnJlZnJlc2goKSk7XG5cdH07XG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXG5cdCAqL1xuXHRBdXRvUmVmcmVzaC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcblxuXHRcdHdpbmRvdy5jbGVhckludGVydmFsKHRoaXMuX2ludGVydmFsKTtcblxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xuXHRcdH1cblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcblx0XHR9XG5cdH07XG5cblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkF1dG9SZWZyZXNoID0gQXV0b1JlZnJlc2g7XG5cbn0pKHdpbmRvdy5aZXB0byB8fCB3aW5kb3cualF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50KTtcblxuLyoqXG4gKiBMYXp5IFBsdWdpblxuICogQHZlcnNpb24gMi4zLjRcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICovXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIHRoZSBsYXp5IHBsdWdpbi5cblx0ICogQGNsYXNzIFRoZSBMYXp5IFBsdWdpblxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXG5cdCAqL1xuXHR2YXIgTGF6eSA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XG5cblx0XHQvKipcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPd2x9XG5cdFx0ICovXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xuXG5cdFx0LyoqXG5cdFx0ICogQWxyZWFkeSBsb2FkZWQgaXRlbXMuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtBcnJheS48alF1ZXJ5Pn1cblx0XHQgKi9cblx0XHR0aGlzLl9sb2FkZWQgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIEV2ZW50IGhhbmRsZXJzLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxuXHRcdCAqL1xuXHRcdHRoaXMuX2hhbmRsZXJzID0ge1xuXHRcdFx0J2luaXRpYWxpemVkLm93bC5jYXJvdXNlbCBjaGFuZ2Uub3dsLmNhcm91c2VsIHJlc2l6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmICghZS5uYW1lc3BhY2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIXRoaXMuX2NvcmUuc2V0dGluZ3MgfHwgIXRoaXMuX2NvcmUuc2V0dGluZ3MubGF6eUxvYWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoKGUucHJvcGVydHkgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHx8IGUudHlwZSA9PSAnaW5pdGlhbGl6ZWQnKSB7XG5cdFx0XHRcdFx0dmFyIHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncyxcblx0XHRcdFx0XHRcdG4gPSAoc2V0dGluZ3MuY2VudGVyICYmIE1hdGguY2VpbChzZXR0aW5ncy5pdGVtcyAvIDIpIHx8IHNldHRpbmdzLml0ZW1zKSxcblx0XHRcdFx0XHRcdGkgPSAoKHNldHRpbmdzLmNlbnRlciAmJiBuICogLTEpIHx8IDApLFxuXHRcdFx0XHRcdFx0cG9zaXRpb24gPSAoZS5wcm9wZXJ0eSAmJiBlLnByb3BlcnR5LnZhbHVlICE9PSB1bmRlZmluZWQgPyBlLnByb3BlcnR5LnZhbHVlIDogdGhpcy5fY29yZS5jdXJyZW50KCkpICsgaSxcblx0XHRcdFx0XHRcdGNsb25lcyA9IHRoaXMuX2NvcmUuY2xvbmVzKCkubGVuZ3RoLFxuXHRcdFx0XHRcdFx0bG9hZCA9ICQucHJveHkoZnVuY3Rpb24oaSwgdikgeyB0aGlzLmxvYWQodikgfSwgdGhpcyk7XG5cdFx0XHRcdFx0Ly9UT0RPOiBOZWVkIGRvY3VtZW50YXRpb24gZm9yIHRoaXMgbmV3IG9wdGlvblxuXHRcdFx0XHRcdGlmIChzZXR0aW5ncy5sYXp5TG9hZEVhZ2VyID4gMCkge1xuXHRcdFx0XHRcdFx0biArPSBzZXR0aW5ncy5sYXp5TG9hZEVhZ2VyO1xuXHRcdFx0XHRcdFx0Ly8gSWYgdGhlIGNhcm91c2VsIGlzIGxvb3BpbmcgYWxzbyBwcmVsb2FkIGltYWdlcyB0aGF0IGFyZSB0byB0aGUgXCJsZWZ0XCJcblx0XHRcdFx0XHRcdGlmIChzZXR0aW5ncy5sb29wKSB7XG4gICAgICAgICAgICAgIHBvc2l0aW9uIC09IHNldHRpbmdzLmxhenlMb2FkRWFnZXI7XG4gICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgIH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR3aGlsZSAoaSsrIDwgbikge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2FkKGNsb25lcyAvIDIgKyB0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSk7XG5cdFx0XHRcdFx0XHRjbG9uZXMgJiYgJC5lYWNoKHRoaXMuX2NvcmUuY2xvbmVzKHRoaXMuX2NvcmUucmVsYXRpdmUocG9zaXRpb24pKSwgbG9hZCk7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbisrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcylcblx0XHR9O1xuXG5cdFx0Ly8gc2V0IHRoZSBkZWZhdWx0IG9wdGlvbnNcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgTGF6eS5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcblxuXHRcdC8vIHJlZ2lzdGVyIGV2ZW50IGhhbmRsZXJcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVmYXVsdCBvcHRpb25zLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRMYXp5LkRlZmF1bHRzID0ge1xuXHRcdGxhenlMb2FkOiBmYWxzZSxcblx0XHRsYXp5TG9hZEVhZ2VyOiAwXG5cdH07XG5cblx0LyoqXG5cdCAqIExvYWRzIGFsbCByZXNvdXJjZXMgb2YgYW4gaXRlbSBhdCB0aGUgc3BlY2lmaWVkIHBvc2l0aW9uLlxuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgYWJzb2x1dGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0uXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdExhenkucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuXHRcdHZhciAkaXRlbSA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCkuZXEocG9zaXRpb24pLFxuXHRcdFx0JGVsZW1lbnRzID0gJGl0ZW0gJiYgJGl0ZW0uZmluZCgnLm93bC1sYXp5Jyk7XG5cblx0XHRpZiAoISRlbGVtZW50cyB8fCAkLmluQXJyYXkoJGl0ZW0uZ2V0KDApLCB0aGlzLl9sb2FkZWQpID4gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkZWxlbWVudHMuZWFjaCgkLnByb3h5KGZ1bmN0aW9uKGluZGV4LCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgJGVsZW1lbnQgPSAkKGVsZW1lbnQpLCBpbWFnZSxcbiAgICAgICAgICAgICAgICB1cmwgPSAod2luZG93LmRldmljZVBpeGVsUmF0aW8gPiAxICYmICRlbGVtZW50LmF0dHIoJ2RhdGEtc3JjLXJldGluYScpKSB8fCAkZWxlbWVudC5hdHRyKCdkYXRhLXNyYycpIHx8ICRlbGVtZW50LmF0dHIoJ2RhdGEtc3Jjc2V0Jyk7XG5cblx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignbG9hZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XG5cblx0XHRcdGlmICgkZWxlbWVudC5pcygnaW1nJykpIHtcblx0XHRcdFx0JGVsZW1lbnQub25lKCdsb2FkLm93bC5sYXp5JywgJC5wcm94eShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHQkZWxlbWVudC5jc3MoJ29wYWNpdHknLCAxKTtcblx0XHRcdFx0XHR0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XG5cdFx0XHRcdH0sIHRoaXMpKS5hdHRyKCdzcmMnLCB1cmwpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICgkZWxlbWVudC5pcygnc291cmNlJykpIHtcbiAgICAgICAgICAgICAgICAkZWxlbWVudC5vbmUoJ2xvYWQub3dsLmxhenknLCAkLnByb3h5KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jb3JlLnRyaWdnZXIoJ2xvYWRlZCcsIHsgZWxlbWVudDogJGVsZW1lbnQsIHVybDogdXJsIH0sICdsYXp5Jyk7XG4gICAgICAgICAgICAgICAgfSwgdGhpcykpLmF0dHIoJ3NyY3NldCcsIHVybCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbWFnZSA9IG5ldyBJbWFnZSgpO1xuXHRcdFx0XHRpbWFnZS5vbmxvYWQgPSAkLnByb3h5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdCRlbGVtZW50LmNzcyh7XG5cdFx0XHRcdFx0XHQnYmFja2dyb3VuZC1pbWFnZSc6ICd1cmwoXCInICsgdXJsICsgJ1wiKScsXG5cdFx0XHRcdFx0XHQnb3BhY2l0eSc6ICcxJ1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignbG9hZGVkJywgeyBlbGVtZW50OiAkZWxlbWVudCwgdXJsOiB1cmwgfSwgJ2xhenknKTtcblx0XHRcdFx0fSwgdGhpcyk7XG5cdFx0XHRcdGltYWdlLnNyYyA9IHVybDtcblx0XHRcdH1cblx0XHR9LCB0aGlzKSk7XG5cblx0XHR0aGlzLl9sb2FkZWQucHVzaCgkaXRlbS5nZXQoMCkpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRMYXp5LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGhhbmRsZXIsIHByb3BlcnR5O1xuXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuaGFuZGxlcnMpIHtcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuaGFuZGxlcnNbaGFuZGxlcl0pO1xuXHRcdH1cblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcblx0XHR9XG5cdH07XG5cblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkxhenkgPSBMYXp5O1xuXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XG5cbi8qKlxuICogQXV0b0hlaWdodCBQbHVnaW5cbiAqIEB2ZXJzaW9uIDIuMy40XG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqL1xuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0aGUgYXV0byBoZWlnaHQgcGx1Z2luLlxuXHQgKiBAY2xhc3MgVGhlIEF1dG8gSGVpZ2h0IFBsdWdpblxuXHQgKiBAcGFyYW0ge093bH0gY2Fyb3VzZWwgLSBUaGUgT3dsIENhcm91c2VsXG5cdCAqL1xuXHR2YXIgQXV0b0hlaWdodCA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XG5cdFx0LyoqXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T3dsfVxuXHRcdCAqL1xuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcblxuXHRcdHRoaXMuX3ByZXZpb3VzSGVpZ2h0ID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge09iamVjdH1cblx0XHQgKi9cblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwgcmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0KSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCAmJiBlLnByb3BlcnR5Lm5hbWUgPT09ICdwb3NpdGlvbicpe1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpLFxuXHRcdFx0J2xvYWRlZC5vd2wubGF6eSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvSGVpZ2h0XG5cdFx0XHRcdFx0JiYgZS5lbGVtZW50LmNsb3Nlc3QoJy4nICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtQ2xhc3MpLmluZGV4KCkgPT09IHRoaXMuX2NvcmUuY3VycmVudCgpKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcylcblx0XHR9O1xuXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBBdXRvSGVpZ2h0LkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcblx0XHR0aGlzLl9pbnRlcnZhbElkID0gbnVsbDtcblx0XHR2YXIgcmVmVGhpcyA9IHRoaXM7XG5cblx0XHQvLyBUaGVzZSBjaGFuZ2VzIGhhdmUgYmVlbiB0YWtlbiBmcm9tIGEgUFIgYnkgZ2F2cm9jaGVsZWdub3UgcHJvcG9zZWQgaW4gIzE1NzVcblx0XHQvLyBhbmQgaGF2ZSBiZWVuIG1hZGUgY29tcGF0aWJsZSB3aXRoIHRoZSBsYXRlc3QgalF1ZXJ5IHZlcnNpb25cblx0XHQkKHdpbmRvdykub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcblx0XHRcdGlmIChyZWZUaGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHQpIHtcblx0XHRcdFx0cmVmVGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIEF1dG9yZXNpemUgdGhlIGhlaWdodCBvZiB0aGUgY2Fyb3VzZWwgd2hlbiB3aW5kb3cgaXMgcmVzaXplZFxuXHRcdC8vIFdoZW4gY2Fyb3VzZWwgaGFzIGltYWdlcywgdGhlIGhlaWdodCBpcyBkZXBlbmRlbnQgb24gdGhlIHdpZHRoXG5cdFx0Ly8gYW5kIHNob3VsZCBhbHNvIGNoYW5nZSBvbiByZXNpemVcblx0XHQkKHdpbmRvdykucmVzaXplKGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKHJlZlRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b0hlaWdodCkge1xuXHRcdFx0XHRpZiAocmVmVGhpcy5faW50ZXJ2YWxJZCAhPSBudWxsKSB7XG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KHJlZlRoaXMuX2ludGVydmFsSWQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmVmVGhpcy5faW50ZXJ2YWxJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0cmVmVGhpcy51cGRhdGUoKTtcblx0XHRcdFx0fSwgMjUwKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdEF1dG9IZWlnaHQuRGVmYXVsdHMgPSB7XG5cdFx0YXV0b0hlaWdodDogZmFsc2UsXG5cdFx0YXV0b0hlaWdodENsYXNzOiAnb3dsLWhlaWdodCdcblx0fTtcblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgdmlldy5cblx0ICovXG5cdEF1dG9IZWlnaHQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzdGFydCA9IHRoaXMuX2NvcmUuX2N1cnJlbnQsXG5cdFx0XHRlbmQgPSBzdGFydCArIHRoaXMuX2NvcmUuc2V0dGluZ3MuaXRlbXMsXG5cdFx0XHRsYXp5TG9hZEVuYWJsZWQgPSB0aGlzLl9jb3JlLnNldHRpbmdzLmxhenlMb2FkLFxuXHRcdFx0dmlzaWJsZSA9IHRoaXMuX2NvcmUuJHN0YWdlLmNoaWxkcmVuKCkudG9BcnJheSgpLnNsaWNlKHN0YXJ0LCBlbmQpLFxuXHRcdFx0aGVpZ2h0cyA9IFtdLFxuXHRcdFx0bWF4aGVpZ2h0ID0gMDtcblxuXHRcdCQuZWFjaCh2aXNpYmxlLCBmdW5jdGlvbihpbmRleCwgaXRlbSkge1xuXHRcdFx0aGVpZ2h0cy5wdXNoKCQoaXRlbSkuaGVpZ2h0KCkpO1xuXHRcdH0pO1xuXG5cdFx0bWF4aGVpZ2h0ID0gTWF0aC5tYXguYXBwbHkobnVsbCwgaGVpZ2h0cyk7XG5cblx0XHRpZiAobWF4aGVpZ2h0IDw9IDEgJiYgbGF6eUxvYWRFbmFibGVkICYmIHRoaXMuX3ByZXZpb3VzSGVpZ2h0KSB7XG5cdFx0XHRtYXhoZWlnaHQgPSB0aGlzLl9wcmV2aW91c0hlaWdodDtcblx0XHR9XG5cblx0XHR0aGlzLl9wcmV2aW91c0hlaWdodCA9IG1heGhlaWdodDtcblxuXHRcdHRoaXMuX2NvcmUuJHN0YWdlLnBhcmVudCgpXG5cdFx0XHQuaGVpZ2h0KG1heGhlaWdodClcblx0XHRcdC5hZGRDbGFzcyh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9IZWlnaHRDbGFzcyk7XG5cdH07XG5cblx0QXV0b0hlaWdodC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcblxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xuXHRcdH1cblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT09ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XG5cdFx0fVxuXHR9O1xuXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5BdXRvSGVpZ2h0ID0gQXV0b0hlaWdodDtcblxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xuXG4vKipcbiAqIFZpZGVvIFBsdWdpblxuICogQHZlcnNpb24gMi4zLjRcbiAqIEBhdXRob3IgQmFydG9zeiBXb2pjaWVjaG93c2tpXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICovXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIHRoZSB2aWRlbyBwbHVnaW4uXG5cdCAqIEBjbGFzcyBUaGUgVmlkZW8gUGx1Z2luXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWxcblx0ICovXG5cdHZhciBWaWRlbyA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XG5cdFx0LyoqXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T3dsfVxuXHRcdCAqL1xuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcblxuXHRcdC8qKlxuXHRcdCAqIENhY2hlIGFsbCB2aWRlbyBVUkxzLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxuXHRcdCAqL1xuXHRcdHRoaXMuX3ZpZGVvcyA9IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogQ3VycmVudCBwbGF5aW5nIGl0ZW0uXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtqUXVlcnl9XG5cdFx0ICovXG5cdFx0dGhpcy5fcGxheWluZyA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXG5cdFx0ICogQHRvZG8gVGhlIGNsb25lZCBjb250ZW50IHJlbW92YWxlIGlzIHRvbyBsYXRlXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XG5cdFx0XHQnaW5pdGlhbGl6ZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xuXHRcdFx0XHRcdHRoaXMuX2NvcmUucmVnaXN0ZXIoeyB0eXBlOiAnc3RhdGUnLCBuYW1lOiAncGxheWluZycsIHRhZ3M6IFsgJ2ludGVyYWN0aW5nJyBdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdyZXNpemUub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLnZpZGVvICYmIHRoaXMuaXNJbkZ1bGxTY3JlZW4oKSkge1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQncmVmcmVzaGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5pcygncmVzaXppbmcnKSkge1xuXHRcdFx0XHRcdHRoaXMuX2NvcmUuJHN0YWdlLmZpbmQoJy5jbG9uZWQgLm93bC12aWRlby1mcmFtZScpLnJlbW92ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdjaGFuZ2VkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09PSAncG9zaXRpb24nICYmIHRoaXMuX3BsYXlpbmcpIHtcblx0XHRcdFx0XHR0aGlzLnN0b3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQncHJlcGFyZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmICghZS5uYW1lc3BhY2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgJGVsZW1lbnQgPSAkKGUuY29udGVudCkuZmluZCgnLm93bC12aWRlbycpO1xuXG5cdFx0XHRcdGlmICgkZWxlbWVudC5sZW5ndGgpIHtcblx0XHRcdFx0XHQkZWxlbWVudC5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuXHRcdFx0XHRcdHRoaXMuZmV0Y2goJGVsZW1lbnQsICQoZS5jb250ZW50KSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpXG5cdFx0fTtcblxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgVmlkZW8uRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XG5cblx0XHQvLyByZWdpc3RlciBldmVudCBoYW5kbGVyc1xuXHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xuXG5cdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vbignY2xpY2sub3dsLnZpZGVvJywgJy5vd2wtdmlkZW8tcGxheS1pY29uJywgJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHR0aGlzLnBsYXkoZSk7XG5cdFx0fSwgdGhpcykpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZWZhdWx0IG9wdGlvbnMuXG5cdCAqIEBwdWJsaWNcblx0ICovXG5cdFZpZGVvLkRlZmF1bHRzID0ge1xuXHRcdHZpZGVvOiBmYWxzZSxcblx0XHR2aWRlb0hlaWdodDogZmFsc2UsXG5cdFx0dmlkZW9XaWR0aDogZmFsc2Vcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgdmlkZW8gSUQgYW5kIHRoZSB0eXBlIChZb3VUdWJlL1ZpbWVvL3Z6YWFyIG9ubHkpLlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSB0YXJnZXQgLSBUaGUgdGFyZ2V0IGNvbnRhaW5pbmcgdGhlIHZpZGVvIGRhdGEuXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSBpdGVtIC0gVGhlIGl0ZW0gY29udGFpbmluZyB0aGUgdmlkZW8uXG5cdCAqL1xuXHRWaWRlby5wcm90b3R5cGUuZmV0Y2ggPSBmdW5jdGlvbih0YXJnZXQsIGl0ZW0pIHtcblx0XHRcdHZhciB0eXBlID0gKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICh0YXJnZXQuYXR0cignZGF0YS12aW1lby1pZCcpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJ3ZpbWVvJztcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHRhcmdldC5hdHRyKCdkYXRhLXZ6YWFyLWlkJykpIHtcblx0XHRcdFx0XHRcdHJldHVybiAndnphYXInXG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAneW91dHViZSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSgpLFxuXHRcdFx0XHRpZCA9IHRhcmdldC5hdHRyKCdkYXRhLXZpbWVvLWlkJykgfHwgdGFyZ2V0LmF0dHIoJ2RhdGEteW91dHViZS1pZCcpIHx8IHRhcmdldC5hdHRyKCdkYXRhLXZ6YWFyLWlkJyksXG5cdFx0XHRcdHdpZHRoID0gdGFyZ2V0LmF0dHIoJ2RhdGEtd2lkdGgnKSB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLnZpZGVvV2lkdGgsXG5cdFx0XHRcdGhlaWdodCA9IHRhcmdldC5hdHRyKCdkYXRhLWhlaWdodCcpIHx8IHRoaXMuX2NvcmUuc2V0dGluZ3MudmlkZW9IZWlnaHQsXG5cdFx0XHRcdHVybCA9IHRhcmdldC5hdHRyKCdocmVmJyk7XG5cblx0XHRpZiAodXJsKSB7XG5cblx0XHRcdC8qXG5cdFx0XHRcdFx0UGFyc2VzIHRoZSBpZCdzIG91dCBvZiB0aGUgZm9sbG93aW5nIHVybHMgKGFuZCBwcm9iYWJseSBtb3JlKTpcblx0XHRcdFx0XHRodHRwczovL3d3dy55b3V0dWJlLmNvbS93YXRjaD92PTppZFxuXHRcdFx0XHRcdGh0dHBzOi8veW91dHUuYmUvOmlkXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vOmlkXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vY2hhbm5lbHMvOmNoYW5uZWwvOmlkXG5cdFx0XHRcdFx0aHR0cHM6Ly92aW1lby5jb20vZ3JvdXBzLzpncm91cC92aWRlb3MvOmlkXG5cdFx0XHRcdFx0aHR0cHM6Ly9hcHAudnphYXIuY29tL3ZpZGVvcy86aWRcblxuXHRcdFx0XHRcdFZpc3VhbCBleGFtcGxlOiBodHRwczovL3JlZ2V4cGVyLmNvbS8jKGh0dHAlM0ElN0NodHRwcyUzQSU3QyklNUMlMkYlNUMlMkYocGxheWVyLiU3Q3d3dy4lN0NhcHAuKSUzRih2aW1lbyU1Qy5jb20lN0N5b3V0dShiZSU1Qy5jb20lN0MlNUMuYmUlN0NiZSU1Qy5nb29nbGVhcGlzJTVDLmNvbSklN0N2emFhciU1Qy5jb20pJTVDJTJGKHZpZGVvJTVDJTJGJTdDdmlkZW9zJTVDJTJGJTdDZW1iZWQlNUMlMkYlN0NjaGFubmVscyU1QyUyRi4lMkIlNUMlMkYlN0Nncm91cHMlNUMlMkYuJTJCJTVDJTJGJTdDd2F0Y2glNUMlM0Z2JTNEJTdDdiU1QyUyRiklM0YoJTVCQS1aYS16MC05Ll8lMjUtJTVEKikoJTVDJTI2JTVDUyUyQiklM0Zcblx0XHRcdCovXG5cblx0XHRcdGlkID0gdXJsLm1hdGNoKC8oaHR0cDp8aHR0cHM6fClcXC9cXC8ocGxheWVyLnx3d3cufGFwcC4pPyh2aW1lb1xcLmNvbXx5b3V0dShiZVxcLmNvbXxcXC5iZXxiZVxcLmdvb2dsZWFwaXNcXC5jb218YmVcXC1ub2Nvb2tpZVxcLmNvbSl8dnphYXJcXC5jb20pXFwvKHZpZGVvXFwvfHZpZGVvc1xcL3xlbWJlZFxcL3xjaGFubmVsc1xcLy4rXFwvfGdyb3Vwc1xcLy4rXFwvfHdhdGNoXFw/dj18dlxcLyk/KFtBLVphLXowLTkuXyUtXSopKFxcJlxcUyspPy8pO1xuXG5cdFx0XHRpZiAoaWRbM10uaW5kZXhPZigneW91dHUnKSA+IC0xKSB7XG5cdFx0XHRcdHR5cGUgPSAneW91dHViZSc7XG5cdFx0XHR9IGVsc2UgaWYgKGlkWzNdLmluZGV4T2YoJ3ZpbWVvJykgPiAtMSkge1xuXHRcdFx0XHR0eXBlID0gJ3ZpbWVvJztcblx0XHRcdH0gZWxzZSBpZiAoaWRbM10uaW5kZXhPZigndnphYXInKSA+IC0xKSB7XG5cdFx0XHRcdHR5cGUgPSAndnphYXInO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdWaWRlbyBVUkwgbm90IHN1cHBvcnRlZC4nKTtcblx0XHRcdH1cblx0XHRcdGlkID0gaWRbNl07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWlzc2luZyB2aWRlbyBVUkwuJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdmlkZW9zW3VybF0gPSB7XG5cdFx0XHR0eXBlOiB0eXBlLFxuXHRcdFx0aWQ6IGlkLFxuXHRcdFx0d2lkdGg6IHdpZHRoLFxuXHRcdFx0aGVpZ2h0OiBoZWlnaHRcblx0XHR9O1xuXG5cdFx0aXRlbS5hdHRyKCdkYXRhLXZpZGVvJywgdXJsKTtcblxuXHRcdHRoaXMudGh1bWJuYWlsKHRhcmdldCwgdGhpcy5fdmlkZW9zW3VybF0pO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIHZpZGVvIHRodW1ibmFpbC5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gdGFyZ2V0IC0gVGhlIHRhcmdldCBjb250YWluaW5nIHRoZSB2aWRlbyBkYXRhLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gaW5mbyAtIFRoZSB2aWRlbyBpbmZvIG9iamVjdC5cblx0ICogQHNlZSBgZmV0Y2hgXG5cdCAqL1xuXHRWaWRlby5wcm90b3R5cGUudGh1bWJuYWlsID0gZnVuY3Rpb24odGFyZ2V0LCB2aWRlbykge1xuXHRcdHZhciB0bkxpbmssXG5cdFx0XHRpY29uLFxuXHRcdFx0cGF0aCxcblx0XHRcdGRpbWVuc2lvbnMgPSB2aWRlby53aWR0aCAmJiB2aWRlby5oZWlnaHQgPyAnd2lkdGg6JyArIHZpZGVvLndpZHRoICsgJ3B4O2hlaWdodDonICsgdmlkZW8uaGVpZ2h0ICsgJ3B4OycgOiAnJyxcblx0XHRcdGN1c3RvbVRuID0gdGFyZ2V0LmZpbmQoJ2ltZycpLFxuXHRcdFx0c3JjVHlwZSA9ICdzcmMnLFxuXHRcdFx0bGF6eUNsYXNzID0gJycsXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3MsXG5cdFx0XHRjcmVhdGUgPSBmdW5jdGlvbihwYXRoKSB7XG5cdFx0XHRcdGljb24gPSAnPGRpdiBjbGFzcz1cIm93bC12aWRlby1wbGF5LWljb25cIj48L2Rpdj4nO1xuXG5cdFx0XHRcdGlmIChzZXR0aW5ncy5sYXp5TG9hZCkge1xuXHRcdFx0XHRcdHRuTGluayA9ICQoJzxkaXYvPicse1xuXHRcdFx0XHRcdFx0XCJjbGFzc1wiOiAnb3dsLXZpZGVvLXRuICcgKyBsYXp5Q2xhc3MsXG5cdFx0XHRcdFx0XHRcInNyY1R5cGVcIjogcGF0aFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRuTGluayA9ICQoICc8ZGl2Lz4nLCB7XG5cdFx0XHRcdFx0XHRcImNsYXNzXCI6IFwib3dsLXZpZGVvLXRuXCIsXG5cdFx0XHRcdFx0XHRcInN0eWxlXCI6ICdvcGFjaXR5OjE7YmFja2dyb3VuZC1pbWFnZTp1cmwoJyArIHBhdGggKyAnKSdcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0YXJnZXQuYWZ0ZXIodG5MaW5rKTtcblx0XHRcdFx0dGFyZ2V0LmFmdGVyKGljb24pO1xuXHRcdFx0fTtcblxuXHRcdC8vIHdyYXAgdmlkZW8gY29udGVudCBpbnRvIG93bC12aWRlby13cmFwcGVyIGRpdlxuXHRcdHRhcmdldC53cmFwKCAkKCAnPGRpdi8+Jywge1xuXHRcdFx0XCJjbGFzc1wiOiBcIm93bC12aWRlby13cmFwcGVyXCIsXG5cdFx0XHRcInN0eWxlXCI6IGRpbWVuc2lvbnNcblx0XHR9KSk7XG5cblx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5sYXp5TG9hZCkge1xuXHRcdFx0c3JjVHlwZSA9ICdkYXRhLXNyYyc7XG5cdFx0XHRsYXp5Q2xhc3MgPSAnb3dsLWxhenknO1xuXHRcdH1cblxuXHRcdC8vIGN1c3RvbSB0aHVtYm5haWxcblx0XHRpZiAoY3VzdG9tVG4ubGVuZ3RoKSB7XG5cdFx0XHRjcmVhdGUoY3VzdG9tVG4uYXR0cihzcmNUeXBlKSk7XG5cdFx0XHRjdXN0b21Ubi5yZW1vdmUoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodmlkZW8udHlwZSA9PT0gJ3lvdXR1YmUnKSB7XG5cdFx0XHRwYXRoID0gXCIvL2ltZy55b3V0dWJlLmNvbS92aS9cIiArIHZpZGVvLmlkICsgXCIvaHFkZWZhdWx0LmpwZ1wiO1xuXHRcdFx0Y3JlYXRlKHBhdGgpO1xuXHRcdH0gZWxzZSBpZiAodmlkZW8udHlwZSA9PT0gJ3ZpbWVvJykge1xuXHRcdFx0JC5hamF4KHtcblx0XHRcdFx0dHlwZTogJ0dFVCcsXG5cdFx0XHRcdHVybDogJy8vdmltZW8uY29tL2FwaS92Mi92aWRlby8nICsgdmlkZW8uaWQgKyAnLmpzb24nLFxuXHRcdFx0XHRqc29ucDogJ2NhbGxiYWNrJyxcblx0XHRcdFx0ZGF0YVR5cGU6ICdqc29ucCcsXG5cdFx0XHRcdHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEpIHtcblx0XHRcdFx0XHRwYXRoID0gZGF0YVswXS50aHVtYm5haWxfbGFyZ2U7XG5cdFx0XHRcdFx0Y3JlYXRlKHBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2emFhcicpIHtcblx0XHRcdCQuYWpheCh7XG5cdFx0XHRcdHR5cGU6ICdHRVQnLFxuXHRcdFx0XHR1cmw6ICcvL3Z6YWFyLmNvbS9hcGkvdmlkZW9zLycgKyB2aWRlby5pZCArICcuanNvbicsXG5cdFx0XHRcdGpzb25wOiAnY2FsbGJhY2snLFxuXHRcdFx0XHRkYXRhVHlwZTogJ2pzb25wJyxcblx0XHRcdFx0c3VjY2VzczogZnVuY3Rpb24oZGF0YSkge1xuXHRcdFx0XHRcdHBhdGggPSBkYXRhLmZyYW1lZ3JhYl91cmw7XG5cdFx0XHRcdFx0Y3JlYXRlKHBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0b3BzIHRoZSBjdXJyZW50IHZpZGVvLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRWaWRlby5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuX2NvcmUudHJpZ2dlcignc3RvcCcsIG51bGwsICd2aWRlbycpO1xuXHRcdHRoaXMuX3BsYXlpbmcuZmluZCgnLm93bC12aWRlby1mcmFtZScpLnJlbW92ZSgpO1xuXHRcdHRoaXMuX3BsYXlpbmcucmVtb3ZlQ2xhc3MoJ293bC12aWRlby1wbGF5aW5nJyk7XG5cdFx0dGhpcy5fcGxheWluZyA9IG51bGw7XG5cdFx0dGhpcy5fY29yZS5sZWF2ZSgncGxheWluZycpO1xuXHRcdHRoaXMuX2NvcmUudHJpZ2dlcignc3RvcHBlZCcsIG51bGwsICd2aWRlbycpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBTdGFydHMgdGhlIGN1cnJlbnQgdmlkZW8uXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgYXJndW1lbnRzLlxuXHQgKi9cblx0VmlkZW8ucHJvdG90eXBlLnBsYXkgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdHZhciB0YXJnZXQgPSAkKGV2ZW50LnRhcmdldCksXG5cdFx0XHRpdGVtID0gdGFyZ2V0LmNsb3Nlc3QoJy4nICsgdGhpcy5fY29yZS5zZXR0aW5ncy5pdGVtQ2xhc3MpLFxuXHRcdFx0dmlkZW8gPSB0aGlzLl92aWRlb3NbaXRlbS5hdHRyKCdkYXRhLXZpZGVvJyldLFxuXHRcdFx0d2lkdGggPSB2aWRlby53aWR0aCB8fCAnMTAwJScsXG5cdFx0XHRoZWlnaHQgPSB2aWRlby5oZWlnaHQgfHwgdGhpcy5fY29yZS4kc3RhZ2UuaGVpZ2h0KCksXG5cdFx0XHRodG1sLFxuXHRcdFx0aWZyYW1lO1xuXG5cdFx0aWYgKHRoaXMuX3BsYXlpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jb3JlLmVudGVyKCdwbGF5aW5nJyk7XG5cdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdwbGF5JywgbnVsbCwgJ3ZpZGVvJyk7XG5cblx0XHRpdGVtID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKGl0ZW0uaW5kZXgoKSkpO1xuXG5cdFx0dGhpcy5fY29yZS5yZXNldChpdGVtLmluZGV4KCkpO1xuXG5cdFx0aHRtbCA9ICQoICc8aWZyYW1lIGZyYW1lYm9yZGVyPVwiMFwiIGFsbG93ZnVsbHNjcmVlbiBtb3phbGxvd2Z1bGxzY3JlZW4gd2Via2l0QWxsb3dGdWxsU2NyZWVuID48L2lmcmFtZT4nICk7XG5cdFx0aHRtbC5hdHRyKCAnaGVpZ2h0JywgaGVpZ2h0ICk7XG5cdFx0aHRtbC5hdHRyKCAnd2lkdGgnLCB3aWR0aCApO1xuXHRcdGlmICh2aWRlby50eXBlID09PSAneW91dHViZScpIHtcblx0XHRcdGh0bWwuYXR0ciggJ3NyYycsICcvL3d3dy55b3V0dWJlLmNvbS9lbWJlZC8nICsgdmlkZW8uaWQgKyAnP2F1dG9wbGF5PTEmcmVsPTAmdj0nICsgdmlkZW8uaWQgKTtcblx0XHR9IGVsc2UgaWYgKHZpZGVvLnR5cGUgPT09ICd2aW1lbycpIHtcblx0XHRcdGh0bWwuYXR0ciggJ3NyYycsICcvL3BsYXllci52aW1lby5jb20vdmlkZW8vJyArIHZpZGVvLmlkICsgJz9hdXRvcGxheT0xJyApO1xuXHRcdH0gZWxzZSBpZiAodmlkZW8udHlwZSA9PT0gJ3Z6YWFyJykge1xuXHRcdFx0aHRtbC5hdHRyKCAnc3JjJywgJy8vdmlldy52emFhci5jb20vJyArIHZpZGVvLmlkICsgJy9wbGF5ZXI/YXV0b3BsYXk9dHJ1ZScgKTtcblx0XHR9XG5cblx0XHRpZnJhbWUgPSAkKGh0bWwpLndyYXAoICc8ZGl2IGNsYXNzPVwib3dsLXZpZGVvLWZyYW1lXCIgLz4nICkuaW5zZXJ0QWZ0ZXIoaXRlbS5maW5kKCcub3dsLXZpZGVvJykpO1xuXG5cdFx0dGhpcy5fcGxheWluZyA9IGl0ZW0uYWRkQ2xhc3MoJ293bC12aWRlby1wbGF5aW5nJyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIENoZWNrcyB3aGV0aGVyIGFuIHZpZGVvIGlzIGN1cnJlbnRseSBpbiBmdWxsIHNjcmVlbiBtb2RlIG9yIG5vdC5cblx0ICogQHRvZG8gQmFkIHN0eWxlIGJlY2F1c2UgbG9va3MgbGlrZSBhIHJlYWRvbmx5IG1ldGhvZCBidXQgY2hhbmdlcyBtZW1iZXJzLlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm5zIHtCb29sZWFufVxuXHQgKi9cblx0VmlkZW8ucHJvdG90eXBlLmlzSW5GdWxsU2NyZWVuID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudCB8fCBkb2N1bWVudC5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fFxuXHRcdFx0XHRkb2N1bWVudC53ZWJraXRGdWxsc2NyZWVuRWxlbWVudDtcblxuXHRcdHJldHVybiBlbGVtZW50ICYmICQoZWxlbWVudCkucGFyZW50KCkuaGFzQ2xhc3MoJ293bC12aWRlby1mcmFtZScpO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxuXHQgKi9cblx0VmlkZW8ucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgaGFuZGxlciwgcHJvcGVydHk7XG5cblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZignY2xpY2sub3dsLnZpZGVvJyk7XG5cblx0XHRmb3IgKGhhbmRsZXIgaW4gdGhpcy5faGFuZGxlcnMpIHtcblx0XHRcdHRoaXMuX2NvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuX2hhbmRsZXJzW2hhbmRsZXJdKTtcblx0XHR9XG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XG5cdFx0fVxuXHR9O1xuXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5WaWRlbyA9IFZpZGVvO1xuXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XG5cbi8qKlxuICogQW5pbWF0ZSBQbHVnaW5cbiAqIEB2ZXJzaW9uIDIuMy40XG4gKiBAYXV0aG9yIEJhcnRvc3ogV29qY2llY2hvd3NraVxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqL1xuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0aGUgYW5pbWF0ZSBwbHVnaW4uXG5cdCAqIEBjbGFzcyBUaGUgTmF2aWdhdGlvbiBQbHVnaW5cblx0ICogQHBhcmFtIHtPd2x9IHNjb3BlIC0gVGhlIE93bCBDYXJvdXNlbFxuXHQgKi9cblx0dmFyIEFuaW1hdGUgPSBmdW5jdGlvbihzY29wZSkge1xuXHRcdHRoaXMuY29yZSA9IHNjb3BlO1xuXHRcdHRoaXMuY29yZS5vcHRpb25zID0gJC5leHRlbmQoe30sIEFuaW1hdGUuRGVmYXVsdHMsIHRoaXMuY29yZS5vcHRpb25zKTtcblx0XHR0aGlzLnN3YXBwaW5nID0gdHJ1ZTtcblx0XHR0aGlzLnByZXZpb3VzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMubmV4dCA9IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuaGFuZGxlcnMgPSB7XG5cdFx0XHQnY2hhbmdlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgZS5wcm9wZXJ0eS5uYW1lID09ICdwb3NpdGlvbicpIHtcblx0XHRcdFx0XHR0aGlzLnByZXZpb3VzID0gdGhpcy5jb3JlLmN1cnJlbnQoKTtcblx0XHRcdFx0XHR0aGlzLm5leHQgPSBlLnByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdkcmFnLm93bC5jYXJvdXNlbCBkcmFnZ2VkLm93bC5jYXJvdXNlbCB0cmFuc2xhdGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcblx0XHRcdFx0XHR0aGlzLnN3YXBwaW5nID0gZS50eXBlID09ICd0cmFuc2xhdGVkJztcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQndHJhbnNsYXRlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5zd2FwcGluZyAmJiAodGhpcy5jb3JlLm9wdGlvbnMuYW5pbWF0ZU91dCB8fCB0aGlzLmNvcmUub3B0aW9ucy5hbmltYXRlSW4pKSB7XG5cdFx0XHRcdFx0dGhpcy5zd2FwKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpXG5cdFx0fTtcblxuXHRcdHRoaXMuY29yZS4kZWxlbWVudC5vbih0aGlzLmhhbmRsZXJzKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVmYXVsdCBvcHRpb25zLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRBbmltYXRlLkRlZmF1bHRzID0ge1xuXHRcdGFuaW1hdGVPdXQ6IGZhbHNlLFxuXHRcdGFuaW1hdGVJbjogZmFsc2Vcblx0fTtcblxuXHQvKipcblx0ICogVG9nZ2xlcyB0aGUgYW5pbWF0aW9uIGNsYXNzZXMgd2hlbmV2ZXIgYW4gdHJhbnNsYXRpb25zIHN0YXJ0cy5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJucyB7Qm9vbGVhbnx1bmRlZmluZWR9XG5cdCAqL1xuXHRBbmltYXRlLnByb3RvdHlwZS5zd2FwID0gZnVuY3Rpb24oKSB7XG5cblx0XHRpZiAodGhpcy5jb3JlLnNldHRpbmdzLml0ZW1zICE9PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCEkLnN1cHBvcnQuYW5pbWF0aW9uIHx8ICEkLnN1cHBvcnQudHJhbnNpdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY29yZS5zcGVlZCgwKTtcblxuXHRcdHZhciBsZWZ0LFxuXHRcdFx0Y2xlYXIgPSAkLnByb3h5KHRoaXMuY2xlYXIsIHRoaXMpLFxuXHRcdFx0cHJldmlvdXMgPSB0aGlzLmNvcmUuJHN0YWdlLmNoaWxkcmVuKCkuZXEodGhpcy5wcmV2aW91cyksXG5cdFx0XHRuZXh0ID0gdGhpcy5jb3JlLiRzdGFnZS5jaGlsZHJlbigpLmVxKHRoaXMubmV4dCksXG5cdFx0XHRpbmNvbWluZyA9IHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlSW4sXG5cdFx0XHRvdXRnb2luZyA9IHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlT3V0O1xuXG5cdFx0aWYgKHRoaXMuY29yZS5jdXJyZW50KCkgPT09IHRoaXMucHJldmlvdXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAob3V0Z29pbmcpIHtcblx0XHRcdGxlZnQgPSB0aGlzLmNvcmUuY29vcmRpbmF0ZXModGhpcy5wcmV2aW91cykgLSB0aGlzLmNvcmUuY29vcmRpbmF0ZXModGhpcy5uZXh0KTtcblx0XHRcdHByZXZpb3VzLm9uZSgkLnN1cHBvcnQuYW5pbWF0aW9uLmVuZCwgY2xlYXIpXG5cdFx0XHRcdC5jc3MoIHsgJ2xlZnQnOiBsZWZ0ICsgJ3B4JyB9IClcblx0XHRcdFx0LmFkZENsYXNzKCdhbmltYXRlZCBvd2wtYW5pbWF0ZWQtb3V0Jylcblx0XHRcdFx0LmFkZENsYXNzKG91dGdvaW5nKTtcblx0XHR9XG5cblx0XHRpZiAoaW5jb21pbmcpIHtcblx0XHRcdG5leHQub25lKCQuc3VwcG9ydC5hbmltYXRpb24uZW5kLCBjbGVhcilcblx0XHRcdFx0LmFkZENsYXNzKCdhbmltYXRlZCBvd2wtYW5pbWF0ZWQtaW4nKVxuXHRcdFx0XHQuYWRkQ2xhc3MoaW5jb21pbmcpO1xuXHRcdH1cblx0fTtcblxuXHRBbmltYXRlLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKGUpIHtcblx0XHQkKGUudGFyZ2V0KS5jc3MoIHsgJ2xlZnQnOiAnJyB9IClcblx0XHRcdC5yZW1vdmVDbGFzcygnYW5pbWF0ZWQgb3dsLWFuaW1hdGVkLW91dCBvd2wtYW5pbWF0ZWQtaW4nKVxuXHRcdFx0LnJlbW92ZUNsYXNzKHRoaXMuY29yZS5zZXR0aW5ncy5hbmltYXRlSW4pXG5cdFx0XHQucmVtb3ZlQ2xhc3ModGhpcy5jb3JlLnNldHRpbmdzLmFuaW1hdGVPdXQpO1xuXHRcdHRoaXMuY29yZS5vblRyYW5zaXRpb25FbmQoKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0QW5pbWF0ZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcblxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLmhhbmRsZXJzKSB7XG5cdFx0XHR0aGlzLmNvcmUuJGVsZW1lbnQub2ZmKGhhbmRsZXIsIHRoaXMuaGFuZGxlcnNbaGFuZGxlcl0pO1xuXHRcdH1cblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcblx0XHR9XG5cdH07XG5cblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkFuaW1hdGUgPSBBbmltYXRlO1xuXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XG5cbi8qKlxuICogQXV0b3BsYXkgUGx1Z2luXG4gKiBAdmVyc2lvbiAyLjMuNFxuICogQGF1dGhvciBCYXJ0b3N6IFdvamNpZWNob3dza2lcbiAqIEBhdXRob3IgQXJ0dXMgS29sYW5vd3NraVxuICogQGF1dGhvciBEYXZpZCBEZXV0c2NoXG4gKiBAYXV0aG9yIFRvbSBEZSBDYWx1d8OpXG4gKiBAbGljZW5zZSBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqL1xuOyhmdW5jdGlvbigkLCB3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuXHQvKipcblx0ICogQ3JlYXRlcyB0aGUgYXV0b3BsYXkgcGx1Z2luLlxuXHQgKiBAY2xhc3MgVGhlIEF1dG9wbGF5IFBsdWdpblxuXHQgKiBAcGFyYW0ge093bH0gc2NvcGUgLSBUaGUgT3dsIENhcm91c2VsXG5cdCAqL1xuXHR2YXIgQXV0b3BsYXkgPSBmdW5jdGlvbihjYXJvdXNlbCkge1xuXHRcdC8qKlxuXHRcdCAqIFJlZmVyZW5jZSB0byB0aGUgY29yZS5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge093bH1cblx0XHQgKi9cblx0XHR0aGlzLl9jb3JlID0gY2Fyb3VzZWw7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYXV0b3BsYXkgdGltZW91dCBpZC5cblx0XHQgKiBAdHlwZSB7TnVtYmVyfVxuXHRcdCAqL1xuXHRcdHRoaXMuX2NhbGwgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogRGVwZW5kaW5nIG9uIHRoZSBzdGF0ZSBvZiB0aGUgcGx1Z2luLCB0aGlzIHZhcmlhYmxlIGNvbnRhaW5zIGVpdGhlclxuXHRcdCAqIHRoZSBzdGFydCB0aW1lIG9mIHRoZSB0aW1lciBvciB0aGUgY3VycmVudCB0aW1lciB2YWx1ZSBpZiBpdCdzXG5cdFx0ICogcGF1c2VkLiBTaW5jZSB3ZSBzdGFydCBpbiBhIHBhdXNlZCBzdGF0ZSB3ZSBpbml0aWFsaXplIHRoZSB0aW1lclxuXHRcdCAqIHZhbHVlLlxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdFx0ICovXG5cdFx0dGhpcy5fdGltZSA9IDA7XG5cblx0XHQvKipcblx0XHQgKiBTdG9yZXMgdGhlIHRpbWVvdXQgY3VycmVudGx5IHVzZWQuXG5cdFx0ICogQHR5cGUge051bWJlcn1cblx0XHQgKi9cblx0XHR0aGlzLl90aW1lb3V0ID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIEluZGljYXRlcyB3aGVuZXZlciB0aGUgYXV0b3BsYXkgaXMgcGF1c2VkLlxuXHRcdCAqIEB0eXBlIHtCb29sZWFufVxuXHRcdCAqL1xuXHRcdHRoaXMuX3BhdXNlZCA9IHRydWU7XG5cblx0XHQvKipcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3NldHRpbmdzJykge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5KSB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5zdG9wKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3Bvc2l0aW9uJyAmJiB0aGlzLl9wYXVzZWQpIHtcblx0XHRcdFx0XHQvLyBSZXNldCB0aGUgdGltZXIuIFRoaXMgY29kZSBpcyB0cmlnZ2VyZWQgd2hlbiB0aGUgcG9zaXRpb25cblx0XHRcdFx0XHQvLyBvZiB0aGUgY2Fyb3VzZWwgd2FzIGNoYW5nZWQgdGhyb3VnaCB1c2VyIGludGVyYWN0aW9uLlxuXHRcdFx0XHRcdHRoaXMuX3RpbWUgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3MuYXV0b3BsYXkpIHtcblx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQncGxheS5vd2wuYXV0b3BsYXknOiAkLnByb3h5KGZ1bmN0aW9uKGUsIHQsIHMpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlKSB7XG5cdFx0XHRcdFx0dGhpcy5wbGF5KHQsIHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdzdG9wLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UpIHtcblx0XHRcdFx0XHR0aGlzLnN0b3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQnbW91c2VvdmVyLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XG5cdFx0XHRcdFx0dGhpcy5wYXVzZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdtb3VzZWxlYXZlLm93bC5hdXRvcGxheSc6ICQucHJveHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5SG92ZXJQYXVzZSAmJiB0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XG5cdFx0XHRcdFx0dGhpcy5wbGF5KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpLFxuXHRcdFx0J3RvdWNoc3RhcnQub3dsLmNvcmUnOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UgJiYgdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xuXHRcdFx0XHRcdHRoaXMucGF1c2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQndG91Y2hlbmQub3dsLmNvcmUnOiAkLnByb3h5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZiAodGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheUhvdmVyUGF1c2UpIHtcblx0XHRcdFx0XHR0aGlzLnBsYXkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcylcblx0XHR9O1xuXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcblx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcblxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgQXV0b3BsYXkuRGVmYXVsdHMsIHRoaXMuX2NvcmUub3B0aW9ucyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIERlZmF1bHQgb3B0aW9ucy5cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0QXV0b3BsYXkuRGVmYXVsdHMgPSB7XG5cdFx0YXV0b3BsYXk6IGZhbHNlLFxuXHRcdGF1dG9wbGF5VGltZW91dDogNTAwMCxcblx0XHRhdXRvcGxheUhvdmVyUGF1c2U6IGZhbHNlLFxuXHRcdGF1dG9wbGF5U3BlZWQ6IGZhbHNlXG5cdH07XG5cblx0LyoqXG5cdCAqIFRyYW5zaXRpb24gdG8gdGhlIG5leHQgc2xpZGUgYW5kIHNldCBhIHRpbWVvdXQgZm9yIHRoZSBuZXh0IHRyYW5zaXRpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbc3BlZWRdIC0gVGhlIGFuaW1hdGlvbiBzcGVlZCBmb3IgdGhlIGFuaW1hdGlvbnMuXG5cdCAqL1xuXHRBdXRvcGxheS5wcm90b3R5cGUuX25leHQgPSBmdW5jdGlvbihzcGVlZCkge1xuXHRcdHRoaXMuX2NhbGwgPSB3aW5kb3cuc2V0VGltZW91dChcblx0XHRcdCQucHJveHkodGhpcy5fbmV4dCwgdGhpcywgc3BlZWQpLFxuXHRcdFx0dGhpcy5fdGltZW91dCAqIChNYXRoLnJvdW5kKHRoaXMucmVhZCgpIC8gdGhpcy5fdGltZW91dCkgKyAxKSAtIHRoaXMucmVhZCgpXG5cdFx0KTtcblxuXHRcdGlmICh0aGlzLl9jb3JlLmlzKCdpbnRlcmFjdGluZycpIHx8IGRvY3VtZW50LmhpZGRlbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9jb3JlLm5leHQoc3BlZWQgfHwgdGhpcy5fY29yZS5zZXR0aW5ncy5hdXRvcGxheVNwZWVkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWFkcyB0aGUgY3VycmVudCB0aW1lciB2YWx1ZSB3aGVuIHRoZSB0aW1lciBpcyBwbGF5aW5nLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRBdXRvcGxheS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMuX3RpbWU7XG5cdH07XG5cblx0LyoqXG5cdCAqIFN0YXJ0cyB0aGUgYXV0b3BsYXkuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFt0aW1lb3V0XSAtIFRoZSBpbnRlcnZhbCBiZWZvcmUgdGhlIG5leHQgYW5pbWF0aW9uIHN0YXJ0cy5cblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgYW5pbWF0aW9uIHNwZWVkIGZvciB0aGUgYW5pbWF0aW9ucy5cblx0ICovXG5cdEF1dG9wbGF5LnByb3RvdHlwZS5wbGF5ID0gZnVuY3Rpb24odGltZW91dCwgc3BlZWQpIHtcblx0XHR2YXIgZWxhcHNlZDtcblxuXHRcdGlmICghdGhpcy5fY29yZS5pcygncm90YXRpbmcnKSkge1xuXHRcdFx0dGhpcy5fY29yZS5lbnRlcigncm90YXRpbmcnKTtcblx0XHR9XG5cblx0XHR0aW1lb3V0ID0gdGltZW91dCB8fCB0aGlzLl9jb3JlLnNldHRpbmdzLmF1dG9wbGF5VGltZW91dDtcblxuXHRcdC8vIENhbGN1bGF0ZSB0aGUgZWxhcHNlZCB0aW1lIHNpbmNlIHRoZSBsYXN0IHRyYW5zaXRpb24uIElmIHRoZSBjYXJvdXNlbFxuXHRcdC8vIHdhc24ndCBwbGF5aW5nIHRoaXMgY2FsY3VsYXRpb24gd2lsbCB5aWVsZCB6ZXJvLlxuXHRcdGVsYXBzZWQgPSBNYXRoLm1pbih0aGlzLl90aW1lICUgKHRoaXMuX3RpbWVvdXQgfHwgdGltZW91dCksIHRpbWVvdXQpO1xuXG5cdFx0aWYgKHRoaXMuX3BhdXNlZCkge1xuXHRcdFx0Ly8gU3RhcnQgdGhlIGNsb2NrLlxuXHRcdFx0dGhpcy5fdGltZSA9IHRoaXMucmVhZCgpO1xuXHRcdFx0dGhpcy5fcGF1c2VkID0gZmFsc2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIENsZWFyIHRoZSBhY3RpdmUgdGltZW91dCB0byBhbGxvdyByZXBsYWNlbWVudC5cblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fY2FsbCk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRqdXN0IHRoZSBvcmlnaW4gb2YgdGhlIHRpbWVyIHRvIG1hdGNoIHRoZSBuZXcgdGltZW91dCB2YWx1ZS5cblx0XHR0aGlzLl90aW1lICs9IHRoaXMucmVhZCgpICUgdGltZW91dCAtIGVsYXBzZWQ7XG5cblx0XHR0aGlzLl90aW1lb3V0ID0gdGltZW91dDtcblx0XHR0aGlzLl9jYWxsID0gd2luZG93LnNldFRpbWVvdXQoJC5wcm94eSh0aGlzLl9uZXh0LCB0aGlzLCBzcGVlZCksIHRpbWVvdXQgLSBlbGFwc2VkKTtcblx0fTtcblxuXHQvKipcblx0ICogU3RvcHMgdGhlIGF1dG9wbGF5LlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRBdXRvcGxheS5wcm90b3R5cGUuc3RvcCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLl9jb3JlLmlzKCdyb3RhdGluZycpKSB7XG5cdFx0XHQvLyBSZXNldCB0aGUgY2xvY2suXG5cdFx0XHR0aGlzLl90aW1lID0gMDtcblx0XHRcdHRoaXMuX3BhdXNlZCA9IHRydWU7XG5cblx0XHRcdHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fY2FsbCk7XG5cdFx0XHR0aGlzLl9jb3JlLmxlYXZlKCdyb3RhdGluZycpO1xuXHRcdH1cblx0fTtcblxuXHQvKipcblx0ICogUGF1c2VzIHRoZSBhdXRvcGxheS5cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0QXV0b3BsYXkucHJvdG90eXBlLnBhdXNlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuX2NvcmUuaXMoJ3JvdGF0aW5nJykgJiYgIXRoaXMuX3BhdXNlZCkge1xuXHRcdFx0Ly8gUGF1c2UgdGhlIGNsb2NrLlxuXHRcdFx0dGhpcy5fdGltZSA9IHRoaXMucmVhZCgpO1xuXHRcdFx0dGhpcy5fcGF1c2VkID0gdHJ1ZTtcblxuXHRcdFx0d2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9jYWxsKTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoZSBwbHVnaW4uXG5cdCAqL1xuXHRBdXRvcGxheS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcblxuXHRcdHRoaXMuc3RvcCgpO1xuXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XG5cdFx0XHR0aGlzLl9jb3JlLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XG5cdFx0fVxuXHRcdGZvciAocHJvcGVydHkgaW4gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGhpcykpIHtcblx0XHRcdHR5cGVvZiB0aGlzW3Byb3BlcnR5XSAhPSAnZnVuY3Rpb24nICYmICh0aGlzW3Byb3BlcnR5XSA9IG51bGwpO1xuXHRcdH1cblx0fTtcblxuXHQkLmZuLm93bENhcm91c2VsLkNvbnN0cnVjdG9yLlBsdWdpbnMuYXV0b3BsYXkgPSBBdXRvcGxheTtcblxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xuXG4vKipcbiAqIE5hdmlnYXRpb24gUGx1Z2luXG4gKiBAdmVyc2lvbiAyLjMuNFxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICovXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdGhlIG5hdmlnYXRpb24gcGx1Z2luLlxuXHQgKiBAY2xhc3MgVGhlIE5hdmlnYXRpb24gUGx1Z2luXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWwuXG5cdCAqL1xuXHR2YXIgTmF2aWdhdGlvbiA9IGZ1bmN0aW9uKGNhcm91c2VsKSB7XG5cdFx0LyoqXG5cdFx0ICogUmVmZXJlbmNlIHRvIHRoZSBjb3JlLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T3dsfVxuXHRcdCAqL1xuXHRcdHRoaXMuX2NvcmUgPSBjYXJvdXNlbDtcblxuXHRcdC8qKlxuXHRcdCAqIEluZGljYXRlcyB3aGV0aGVyIHRoZSBwbHVnaW4gaXMgaW5pdGlhbGl6ZWQgb3Igbm90LlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKi9cblx0XHR0aGlzLl9pbml0aWFsaXplZCA9IGZhbHNlO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGN1cnJlbnQgcGFnaW5nIGluZGV4ZXMuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtBcnJheX1cblx0XHQgKi9cblx0XHR0aGlzLl9wYWdlcyA9IFtdO1xuXG5cdFx0LyoqXG5cdFx0ICogQWxsIERPTSBlbGVtZW50cyBvZiB0aGUgdXNlciBpbnRlcmZhY2UuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0dGhpcy5fY29udHJvbHMgPSB7fTtcblxuXHRcdC8qKlxuXHRcdCAqIE1hcmt1cCBmb3IgYW4gaW5kaWNhdG9yLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7QXJyYXkuPFN0cmluZz59XG5cdFx0ICovXG5cdFx0dGhpcy5fdGVtcGxhdGVzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBUaGUgY2Fyb3VzZWwgZWxlbWVudC5cblx0XHQgKiBAdHlwZSB7alF1ZXJ5fVxuXHRcdCAqL1xuXHRcdHRoaXMuJGVsZW1lbnQgPSB0aGlzLl9jb3JlLiRlbGVtZW50O1xuXG5cdFx0LyoqXG5cdFx0ICogT3ZlcnJpZGRlbiBtZXRob2RzIG9mIHRoZSBjYXJvdXNlbC5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge09iamVjdH1cblx0XHQgKi9cblx0XHR0aGlzLl9vdmVycmlkZXMgPSB7XG5cdFx0XHRuZXh0OiB0aGlzLl9jb3JlLm5leHQsXG5cdFx0XHRwcmV2OiB0aGlzLl9jb3JlLnByZXYsXG5cdFx0XHR0bzogdGhpcy5fY29yZS50b1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBBbGwgZXZlbnQgaGFuZGxlcnMuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPYmplY3R9XG5cdFx0ICovXG5cdFx0dGhpcy5faGFuZGxlcnMgPSB7XG5cdFx0XHQncHJlcGFyZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiB0aGlzLl9jb3JlLnNldHRpbmdzLmRvdHNEYXRhKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGVtcGxhdGVzLnB1c2goJzxkaXYgY2xhc3M9XCInICsgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RDbGFzcyArICdcIj4nICtcblx0XHRcdFx0XHRcdCQoZS5jb250ZW50KS5maW5kKCdbZGF0YS1kb3RdJykuYWRkQmFjaygnW2RhdGEtZG90XScpLmF0dHIoJ2RhdGEtZG90JykgKyAnPC9kaXY+Jyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpLFxuXHRcdFx0J2FkZGVkLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RzRGF0YSkge1xuXHRcdFx0XHRcdHRoaXMuX3RlbXBsYXRlcy5zcGxpY2UoZS5wb3NpdGlvbiwgMCwgdGhpcy5fdGVtcGxhdGVzLnBvcCgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQncmVtb3ZlLm93bC5jYXJvdXNlbCc6ICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHRpZiAoZS5uYW1lc3BhY2UgJiYgdGhpcy5fY29yZS5zZXR0aW5ncy5kb3RzRGF0YSkge1xuXHRcdFx0XHRcdHRoaXMuX3RlbXBsYXRlcy5zcGxpY2UoZS5wb3NpdGlvbiwgMSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpLFxuXHRcdFx0J2NoYW5nZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSAmJiBlLnByb3BlcnR5Lm5hbWUgPT0gJ3Bvc2l0aW9uJykge1xuXHRcdFx0XHRcdHRoaXMuZHJhdygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzKSxcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmICF0aGlzLl9pbml0aWFsaXplZCkge1xuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcignaW5pdGlhbGl6ZScsIG51bGwsICduYXZpZ2F0aW9uJyk7XG5cdFx0XHRcdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdFx0XHR0aGlzLmRyYXcoKTtcblx0XHRcdFx0XHR0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdpbml0aWFsaXplZCcsIG51bGwsICduYXZpZ2F0aW9uJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpLFxuXHRcdFx0J3JlZnJlc2hlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2luaXRpYWxpemVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29yZS50cmlnZ2VyKCdyZWZyZXNoJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdFx0XHRcdHRoaXMuZHJhdygpO1xuXHRcdFx0XHRcdHRoaXMuX2NvcmUudHJpZ2dlcigncmVmcmVzaGVkJywgbnVsbCwgJ25hdmlnYXRpb24nKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcylcblx0XHR9O1xuXG5cdFx0Ly8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuXHRcdHRoaXMuX2NvcmUub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBOYXZpZ2F0aW9uLkRlZmF1bHRzLCB0aGlzLl9jb3JlLm9wdGlvbnMpO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgaGFuZGxlcnNcblx0XHR0aGlzLiRlbGVtZW50Lm9uKHRoaXMuX2hhbmRsZXJzKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVmYXVsdCBvcHRpb25zLlxuXHQgKiBAcHVibGljXG5cdCAqIEB0b2RvIFJlbmFtZSBgc2xpZGVCeWAgdG8gYG5hdkJ5YFxuXHQgKi9cblx0TmF2aWdhdGlvbi5EZWZhdWx0cyA9IHtcblx0XHRuYXY6IGZhbHNlLFxuXHRcdG5hdlRleHQ6IFtcblx0XHRcdCc8c3BhbiBhcmlhLWxhYmVsPVwiJyArICdQcmV2aW91cycgKyAnXCI+JiN4MjAzOTs8L3NwYW4+Jyxcblx0XHRcdCc8c3BhbiBhcmlhLWxhYmVsPVwiJyArICdOZXh0JyArICdcIj4mI3gyMDNhOzwvc3Bhbj4nXG5cdFx0XSxcblx0XHRuYXZTcGVlZDogZmFsc2UsXG5cdFx0bmF2RWxlbWVudDogJ2J1dHRvbiB0eXBlPVwiYnV0dG9uXCIgcm9sZT1cInByZXNlbnRhdGlvblwiJyxcblx0XHRuYXZDb250YWluZXI6IGZhbHNlLFxuXHRcdG5hdkNvbnRhaW5lckNsYXNzOiAnb3dsLW5hdicsXG5cdFx0bmF2Q2xhc3M6IFtcblx0XHRcdCdvd2wtcHJldicsXG5cdFx0XHQnb3dsLW5leHQnXG5cdFx0XSxcblx0XHRzbGlkZUJ5OiAxLFxuXHRcdGRvdENsYXNzOiAnb3dsLWRvdCcsXG5cdFx0ZG90c0NsYXNzOiAnb3dsLWRvdHMnLFxuXHRcdGRvdHM6IHRydWUsXG5cdFx0ZG90c0VhY2g6IGZhbHNlLFxuXHRcdGRvdHNEYXRhOiBmYWxzZSxcblx0XHRkb3RzU3BlZWQ6IGZhbHNlLFxuXHRcdGRvdHNDb250YWluZXI6IGZhbHNlXG5cdH07XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemVzIHRoZSBsYXlvdXQgb2YgdGhlIHBsdWdpbiBhbmQgZXh0ZW5kcyB0aGUgY2Fyb3VzZWwuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgb3ZlcnJpZGUsXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XG5cblx0XHQvLyBjcmVhdGUgRE9NIHN0cnVjdHVyZSBmb3IgcmVsYXRpdmUgbmF2aWdhdGlvblxuXHRcdHRoaXMuX2NvbnRyb2xzLiRyZWxhdGl2ZSA9IChzZXR0aW5ncy5uYXZDb250YWluZXIgPyAkKHNldHRpbmdzLm5hdkNvbnRhaW5lcilcblx0XHRcdDogJCgnPGRpdj4nKS5hZGRDbGFzcyhzZXR0aW5ncy5uYXZDb250YWluZXJDbGFzcykuYXBwZW5kVG8odGhpcy4kZWxlbWVudCkpLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xuXG5cdFx0dGhpcy5fY29udHJvbHMuJHByZXZpb3VzID0gJCgnPCcgKyBzZXR0aW5ncy5uYXZFbGVtZW50ICsgJz4nKVxuXHRcdFx0LmFkZENsYXNzKHNldHRpbmdzLm5hdkNsYXNzWzBdKVxuXHRcdFx0Lmh0bWwoc2V0dGluZ3MubmF2VGV4dFswXSlcblx0XHRcdC5wcmVwZW5kVG8odGhpcy5fY29udHJvbHMuJHJlbGF0aXZlKVxuXHRcdFx0Lm9uKCdjbGljaycsICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0XHR0aGlzLnByZXYoc2V0dGluZ3MubmF2U3BlZWQpO1xuXHRcdFx0fSwgdGhpcykpO1xuXHRcdHRoaXMuX2NvbnRyb2xzLiRuZXh0ID0gJCgnPCcgKyBzZXR0aW5ncy5uYXZFbGVtZW50ICsgJz4nKVxuXHRcdFx0LmFkZENsYXNzKHNldHRpbmdzLm5hdkNsYXNzWzFdKVxuXHRcdFx0Lmh0bWwoc2V0dGluZ3MubmF2VGV4dFsxXSlcblx0XHRcdC5hcHBlbmRUbyh0aGlzLl9jb250cm9scy4kcmVsYXRpdmUpXG5cdFx0XHQub24oJ2NsaWNrJywgJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdHRoaXMubmV4dChzZXR0aW5ncy5uYXZTcGVlZCk7XG5cdFx0XHR9LCB0aGlzKSk7XG5cblx0XHQvLyBjcmVhdGUgRE9NIHN0cnVjdHVyZSBmb3IgYWJzb2x1dGUgbmF2aWdhdGlvblxuXHRcdGlmICghc2V0dGluZ3MuZG90c0RhdGEpIHtcblx0XHRcdHRoaXMuX3RlbXBsYXRlcyA9IFsgJCgnPGJ1dHRvbiByb2xlPVwiYnV0dG9uXCI+Jylcblx0XHRcdFx0LmFkZENsYXNzKHNldHRpbmdzLmRvdENsYXNzKVxuXHRcdFx0XHQuYXBwZW5kKCQoJzxzcGFuPicpKVxuXHRcdFx0XHQucHJvcCgnb3V0ZXJIVE1MJykgXTtcblx0XHR9XG5cblx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUgPSAoc2V0dGluZ3MuZG90c0NvbnRhaW5lciA/ICQoc2V0dGluZ3MuZG90c0NvbnRhaW5lcilcblx0XHRcdDogJCgnPGRpdj4nKS5hZGRDbGFzcyhzZXR0aW5ncy5kb3RzQ2xhc3MpLmFwcGVuZFRvKHRoaXMuJGVsZW1lbnQpKS5hZGRDbGFzcygnZGlzYWJsZWQnKTtcblxuXHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5vbignY2xpY2snLCAnYnV0dG9uJywgJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHR2YXIgaW5kZXggPSAkKGUudGFyZ2V0KS5wYXJlbnQoKS5pcyh0aGlzLl9jb250cm9scy4kYWJzb2x1dGUpXG5cdFx0XHRcdD8gJChlLnRhcmdldCkuaW5kZXgoKSA6ICQoZS50YXJnZXQpLnBhcmVudCgpLmluZGV4KCk7XG5cblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0dGhpcy50byhpbmRleCwgc2V0dGluZ3MuZG90c1NwZWVkKTtcblx0XHR9LCB0aGlzKSk7XG5cblx0XHQvKiRlbC5vbignZm9jdXNpbicsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JChkb2N1bWVudCkub2ZmKFwiLmNhcm91c2VsXCIpO1xuXG5cdFx0XHQkKGRvY3VtZW50KS5vbigna2V5ZG93bi5jYXJvdXNlbCcsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYoZS5rZXlDb2RlID09IDM3KSB7XG5cdFx0XHRcdFx0JGVsLnRyaWdnZXIoJ3ByZXYub3dsJylcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihlLmtleUNvZGUgPT0gMzkpIHtcblx0XHRcdFx0XHQkZWwudHJpZ2dlcignbmV4dC5vd2wnKVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTsqL1xuXG5cdFx0Ly8gb3ZlcnJpZGUgcHVibGljIG1ldGhvZHMgb2YgdGhlIGNhcm91c2VsXG5cdFx0Zm9yIChvdmVycmlkZSBpbiB0aGlzLl9vdmVycmlkZXMpIHtcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gJC5wcm94eSh0aGlzW292ZXJyaWRlXSwgdGhpcyk7XG5cdFx0fVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGUgcGx1Z2luLlxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGhhbmRsZXIsIGNvbnRyb2wsIHByb3BlcnR5LCBvdmVycmlkZSwgc2V0dGluZ3M7XG5cdFx0c2V0dGluZ3MgPSB0aGlzLl9jb3JlLnNldHRpbmdzO1xuXG5cdFx0Zm9yIChoYW5kbGVyIGluIHRoaXMuX2hhbmRsZXJzKSB7XG5cdFx0XHR0aGlzLiRlbGVtZW50Lm9mZihoYW5kbGVyLCB0aGlzLl9oYW5kbGVyc1toYW5kbGVyXSk7XG5cdFx0fVxuXHRcdGZvciAoY29udHJvbCBpbiB0aGlzLl9jb250cm9scykge1xuXHRcdFx0aWYgKGNvbnRyb2wgPT09ICckcmVsYXRpdmUnICYmIHNldHRpbmdzLm5hdkNvbnRhaW5lcikge1xuXHRcdFx0XHR0aGlzLl9jb250cm9sc1tjb250cm9sXS5odG1sKCcnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xzW2NvbnRyb2xdLnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRmb3IgKG92ZXJyaWRlIGluIHRoaXMub3ZlcmlkZXMpIHtcblx0XHRcdHRoaXMuX2NvcmVbb3ZlcnJpZGVdID0gdGhpcy5fb3ZlcnJpZGVzW292ZXJyaWRlXTtcblx0XHR9XG5cdFx0Zm9yIChwcm9wZXJ0eSBpbiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0aGlzKSkge1xuXHRcdFx0dHlwZW9mIHRoaXNbcHJvcGVydHldICE9ICdmdW5jdGlvbicgJiYgKHRoaXNbcHJvcGVydHldID0gbnVsbCk7XG5cdFx0fVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBVcGRhdGVzIHRoZSBpbnRlcm5hbCBzdGF0ZS5cblx0ICogQHByb3RlY3RlZFxuXHQgKi9cblx0TmF2aWdhdGlvbi5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGksIGosIGssXG5cdFx0XHRsb3dlciA9IHRoaXMuX2NvcmUuY2xvbmVzKCkubGVuZ3RoIC8gMixcblx0XHRcdHVwcGVyID0gbG93ZXIgKyB0aGlzLl9jb3JlLml0ZW1zKCkubGVuZ3RoLFxuXHRcdFx0bWF4aW11bSA9IHRoaXMuX2NvcmUubWF4aW11bSh0cnVlKSxcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncyxcblx0XHRcdHNpemUgPSBzZXR0aW5ncy5jZW50ZXIgfHwgc2V0dGluZ3MuYXV0b1dpZHRoIHx8IHNldHRpbmdzLmRvdHNEYXRhXG5cdFx0XHRcdD8gMSA6IHNldHRpbmdzLmRvdHNFYWNoIHx8IHNldHRpbmdzLml0ZW1zO1xuXG5cdFx0aWYgKHNldHRpbmdzLnNsaWRlQnkgIT09ICdwYWdlJykge1xuXHRcdFx0c2V0dGluZ3Muc2xpZGVCeSA9IE1hdGgubWluKHNldHRpbmdzLnNsaWRlQnksIHNldHRpbmdzLml0ZW1zKTtcblx0XHR9XG5cblx0XHRpZiAoc2V0dGluZ3MuZG90cyB8fCBzZXR0aW5ncy5zbGlkZUJ5ID09ICdwYWdlJykge1xuXHRcdFx0dGhpcy5fcGFnZXMgPSBbXTtcblxuXHRcdFx0Zm9yIChpID0gbG93ZXIsIGogPSAwLCBrID0gMDsgaSA8IHVwcGVyOyBpKyspIHtcblx0XHRcdFx0aWYgKGogPj0gc2l6ZSB8fCBqID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fcGFnZXMucHVzaCh7XG5cdFx0XHRcdFx0XHRzdGFydDogTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSxcblx0XHRcdFx0XHRcdGVuZDogaSAtIGxvd2VyICsgc2l6ZSAtIDFcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRpZiAoTWF0aC5taW4obWF4aW11bSwgaSAtIGxvd2VyKSA9PT0gbWF4aW11bSkge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGogPSAwLCArK2s7XG5cdFx0XHRcdH1cblx0XHRcdFx0aiArPSB0aGlzLl9jb3JlLm1lcmdlcnModGhpcy5fY29yZS5yZWxhdGl2ZShpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdC8qKlxuXHQgKiBEcmF3cyB0aGUgdXNlciBpbnRlcmZhY2UuXG5cdCAqIEB0b2RvIFRoZSBvcHRpb24gYGRvdHNEYXRhYCB3b250IHdvcmsuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgZGlmZmVyZW5jZSxcblx0XHRcdHNldHRpbmdzID0gdGhpcy5fY29yZS5zZXR0aW5ncyxcblx0XHRcdGRpc2FibGVkID0gdGhpcy5fY29yZS5pdGVtcygpLmxlbmd0aCA8PSBzZXR0aW5ncy5pdGVtcyxcblx0XHRcdGluZGV4ID0gdGhpcy5fY29yZS5yZWxhdGl2ZSh0aGlzLl9jb3JlLmN1cnJlbnQoKSksXG5cdFx0XHRsb29wID0gc2V0dGluZ3MubG9vcCB8fCBzZXR0aW5ncy5yZXdpbmQ7XG5cblx0XHR0aGlzLl9jb250cm9scy4kcmVsYXRpdmUudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIXNldHRpbmdzLm5hdiB8fCBkaXNhYmxlZCk7XG5cblx0XHRpZiAoc2V0dGluZ3MubmF2KSB7XG5cdFx0XHR0aGlzLl9jb250cm9scy4kcHJldmlvdXMudG9nZ2xlQ2xhc3MoJ2Rpc2FibGVkJywgIWxvb3AgJiYgaW5kZXggPD0gdGhpcy5fY29yZS5taW5pbXVtKHRydWUpKTtcblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRuZXh0LnRvZ2dsZUNsYXNzKCdkaXNhYmxlZCcsICFsb29wICYmIGluZGV4ID49IHRoaXMuX2NvcmUubWF4aW11bSh0cnVlKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLnRvZ2dsZUNsYXNzKCdkaXNhYmxlZCcsICFzZXR0aW5ncy5kb3RzIHx8IGRpc2FibGVkKTtcblxuXHRcdGlmIChzZXR0aW5ncy5kb3RzKSB7XG5cdFx0XHRkaWZmZXJlbmNlID0gdGhpcy5fcGFnZXMubGVuZ3RoIC0gdGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkubGVuZ3RoO1xuXG5cdFx0XHRpZiAoc2V0dGluZ3MuZG90c0RhdGEgJiYgZGlmZmVyZW5jZSAhPT0gMCkge1xuXHRcdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuaHRtbCh0aGlzLl90ZW1wbGF0ZXMuam9pbignJykpO1xuXHRcdFx0fSBlbHNlIGlmIChkaWZmZXJlbmNlID4gMCkge1xuXHRcdFx0XHR0aGlzLl9jb250cm9scy4kYWJzb2x1dGUuYXBwZW5kKG5ldyBBcnJheShkaWZmZXJlbmNlICsgMSkuam9pbih0aGlzLl90ZW1wbGF0ZXNbMF0pKTtcblx0XHRcdH0gZWxzZSBpZiAoZGlmZmVyZW5jZSA8IDApIHtcblx0XHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkuc2xpY2UoZGlmZmVyZW5jZSkucmVtb3ZlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2NvbnRyb2xzLiRhYnNvbHV0ZS5maW5kKCcuYWN0aXZlJykucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xuXHRcdFx0dGhpcy5fY29udHJvbHMuJGFic29sdXRlLmNoaWxkcmVuKCkuZXEoJC5pbkFycmF5KHRoaXMuY3VycmVudCgpLCB0aGlzLl9wYWdlcykpLmFkZENsYXNzKCdhY3RpdmUnKTtcblx0XHR9XG5cdH07XG5cblx0LyoqXG5cdCAqIEV4dGVuZHMgZXZlbnQgZGF0YS5cblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCAtIFRoZSBldmVudCBvYmplY3Qgd2hpY2ggZ2V0cyB0aHJvd24uXG5cdCAqL1xuXHROYXZpZ2F0aW9uLnByb3RvdHlwZS5vblRyaWdnZXIgPSBmdW5jdGlvbihldmVudCkge1xuXHRcdHZhciBzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XG5cblx0XHRldmVudC5wYWdlID0ge1xuXHRcdFx0aW5kZXg6ICQuaW5BcnJheSh0aGlzLmN1cnJlbnQoKSwgdGhpcy5fcGFnZXMpLFxuXHRcdFx0Y291bnQ6IHRoaXMuX3BhZ2VzLmxlbmd0aCxcblx0XHRcdHNpemU6IHNldHRpbmdzICYmIChzZXR0aW5ncy5jZW50ZXIgfHwgc2V0dGluZ3MuYXV0b1dpZHRoIHx8IHNldHRpbmdzLmRvdHNEYXRhXG5cdFx0XHRcdD8gMSA6IHNldHRpbmdzLmRvdHNFYWNoIHx8IHNldHRpbmdzLml0ZW1zKVxuXHRcdH07XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGN1cnJlbnQgcGFnZSBwb3NpdGlvbiBvZiB0aGUgY2Fyb3VzZWwuXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHJldHVybnMge051bWJlcn1cblx0ICovXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgY3VycmVudCA9IHRoaXMuX2NvcmUucmVsYXRpdmUodGhpcy5fY29yZS5jdXJyZW50KCkpO1xuXHRcdHJldHVybiAkLmdyZXAodGhpcy5fcGFnZXMsICQucHJveHkoZnVuY3Rpb24ocGFnZSwgaW5kZXgpIHtcblx0XHRcdHJldHVybiBwYWdlLnN0YXJ0IDw9IGN1cnJlbnQgJiYgcGFnZS5lbmQgPj0gY3VycmVudDtcblx0XHR9LCB0aGlzKSkucG9wKCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIGN1cnJlbnQgc3VjY2Vzb3IvcHJlZGVjZXNzb3IgcG9zaXRpb24uXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHJldHVybnMge051bWJlcn1cblx0ICovXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24oc3VjY2Vzc29yKSB7XG5cdFx0dmFyIHBvc2l0aW9uLCBsZW5ndGgsXG5cdFx0XHRzZXR0aW5ncyA9IHRoaXMuX2NvcmUuc2V0dGluZ3M7XG5cblx0XHRpZiAoc2V0dGluZ3Muc2xpZGVCeSA9PSAncGFnZScpIHtcblx0XHRcdHBvc2l0aW9uID0gJC5pbkFycmF5KHRoaXMuY3VycmVudCgpLCB0aGlzLl9wYWdlcyk7XG5cdFx0XHRsZW5ndGggPSB0aGlzLl9wYWdlcy5sZW5ndGg7XG5cdFx0XHRzdWNjZXNzb3IgPyArK3Bvc2l0aW9uIDogLS1wb3NpdGlvbjtcblx0XHRcdHBvc2l0aW9uID0gdGhpcy5fcGFnZXNbKChwb3NpdGlvbiAlIGxlbmd0aCkgKyBsZW5ndGgpICUgbGVuZ3RoXS5zdGFydDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cG9zaXRpb24gPSB0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKTtcblx0XHRcdGxlbmd0aCA9IHRoaXMuX2NvcmUuaXRlbXMoKS5sZW5ndGg7XG5cdFx0XHRzdWNjZXNzb3IgPyBwb3NpdGlvbiArPSBzZXR0aW5ncy5zbGlkZUJ5IDogcG9zaXRpb24gLT0gc2V0dGluZ3Muc2xpZGVCeTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcG9zaXRpb247XG5cdH07XG5cblx0LyoqXG5cdCAqIFNsaWRlcyB0byB0aGUgbmV4dCBpdGVtIG9yIHBhZ2UuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZD1mYWxzZV0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxuXHQgKi9cblx0TmF2aWdhdGlvbi5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKHNwZWVkKSB7XG5cdFx0JC5wcm94eSh0aGlzLl9vdmVycmlkZXMudG8sIHRoaXMuX2NvcmUpKHRoaXMuZ2V0UG9zaXRpb24odHJ1ZSksIHNwZWVkKTtcblx0fTtcblxuXHQvKipcblx0ICogU2xpZGVzIHRvIHRoZSBwcmV2aW91cyBpdGVtIG9yIHBhZ2UuXG5cdCAqIEBwdWJsaWNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZD1mYWxzZV0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxuXHQgKi9cblx0TmF2aWdhdGlvbi5wcm90b3R5cGUucHJldiA9IGZ1bmN0aW9uKHNwZWVkKSB7XG5cdFx0JC5wcm94eSh0aGlzLl9vdmVycmlkZXMudG8sIHRoaXMuX2NvcmUpKHRoaXMuZ2V0UG9zaXRpb24oZmFsc2UpLCBzcGVlZCk7XG5cdH07XG5cblx0LyoqXG5cdCAqIFNsaWRlcyB0byB0aGUgc3BlY2lmaWVkIGl0ZW0gb3IgcGFnZS5cblx0ICogQHB1YmxpY1xuXHQgKiBAcGFyYW0ge051bWJlcn0gcG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGl0ZW0gb3IgcGFnZS5cblx0ICogQHBhcmFtIHtOdW1iZXJ9IFtzcGVlZF0gLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgZm9yIHRoZSB0cmFuc2l0aW9uLlxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IFtzdGFuZGFyZD1mYWxzZV0gLSBXaGV0aGVyIHRvIHVzZSB0aGUgc3RhbmRhcmQgYmVoYXZpb3VyIG9yIG5vdC5cblx0ICovXG5cdE5hdmlnYXRpb24ucHJvdG90eXBlLnRvID0gZnVuY3Rpb24ocG9zaXRpb24sIHNwZWVkLCBzdGFuZGFyZCkge1xuXHRcdHZhciBsZW5ndGg7XG5cblx0XHRpZiAoIXN0YW5kYXJkICYmIHRoaXMuX3BhZ2VzLmxlbmd0aCkge1xuXHRcdFx0bGVuZ3RoID0gdGhpcy5fcGFnZXMubGVuZ3RoO1xuXHRcdFx0JC5wcm94eSh0aGlzLl9vdmVycmlkZXMudG8sIHRoaXMuX2NvcmUpKHRoaXMuX3BhZ2VzWygocG9zaXRpb24gJSBsZW5ndGgpICsgbGVuZ3RoKSAlIGxlbmd0aF0uc3RhcnQsIHNwZWVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0JC5wcm94eSh0aGlzLl9vdmVycmlkZXMudG8sIHRoaXMuX2NvcmUpKHBvc2l0aW9uLCBzcGVlZCk7XG5cdFx0fVxuXHR9O1xuXG5cdCQuZm4ub3dsQ2Fyb3VzZWwuQ29uc3RydWN0b3IuUGx1Z2lucy5OYXZpZ2F0aW9uID0gTmF2aWdhdGlvbjtcblxufSkod2luZG93LlplcHRvIHx8IHdpbmRvdy5qUXVlcnksIHdpbmRvdywgZG9jdW1lbnQpO1xuXG4vKipcbiAqIEhhc2ggUGx1Z2luXG4gKiBAdmVyc2lvbiAyLjMuNFxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICovXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgdGhlIGhhc2ggcGx1Z2luLlxuXHQgKiBAY2xhc3MgVGhlIEhhc2ggUGx1Z2luXG5cdCAqIEBwYXJhbSB7T3dsfSBjYXJvdXNlbCAtIFRoZSBPd2wgQ2Fyb3VzZWxcblx0ICovXG5cdHZhciBIYXNoID0gZnVuY3Rpb24oY2Fyb3VzZWwpIHtcblx0XHQvKipcblx0XHQgKiBSZWZlcmVuY2UgdG8gdGhlIGNvcmUuXG5cdFx0ICogQHByb3RlY3RlZFxuXHRcdCAqIEB0eXBlIHtPd2x9XG5cdFx0ICovXG5cdFx0dGhpcy5fY29yZSA9IGNhcm91c2VsO1xuXG5cdFx0LyoqXG5cdFx0ICogSGFzaCBpbmRleCBmb3IgdGhlIGl0ZW1zLlxuXHRcdCAqIEBwcm90ZWN0ZWRcblx0XHQgKiBAdHlwZSB7T2JqZWN0fVxuXHRcdCAqL1xuXHRcdHRoaXMuX2hhc2hlcyA9IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGNhcm91c2VsIGVsZW1lbnQuXG5cdFx0ICogQHR5cGUge2pRdWVyeX1cblx0XHQgKi9cblx0XHR0aGlzLiRlbGVtZW50ID0gdGhpcy5fY29yZS4kZWxlbWVudDtcblxuXHRcdC8qKlxuXHRcdCAqIEFsbCBldmVudCBoYW5kbGVycy5cblx0XHQgKiBAcHJvdGVjdGVkXG5cdFx0ICogQHR5cGUge09iamVjdH1cblx0XHQgKi9cblx0XHR0aGlzLl9oYW5kbGVycyA9IHtcblx0XHRcdCdpbml0aWFsaXplZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIHRoaXMuX2NvcmUuc2V0dGluZ3Muc3RhcnRQb3NpdGlvbiA9PT0gJ1VSTEhhc2gnKSB7XG5cdFx0XHRcdFx0JCh3aW5kb3cpLnRyaWdnZXIoJ2hhc2hjaGFuZ2Uub3dsLm5hdmlnYXRpb24nKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQncHJlcGFyZWQub3dsLmNhcm91c2VsJzogJC5wcm94eShmdW5jdGlvbihlKSB7XG5cdFx0XHRcdGlmIChlLm5hbWVzcGFjZSkge1xuXHRcdFx0XHRcdHZhciBoYXNoID0gJChlLmNvbnRlbnQpLmZpbmQoJ1tkYXRhLWhhc2hdJykuYWRkQmFjaygnW2RhdGEtaGFzaF0nKS5hdHRyKCdkYXRhLWhhc2gnKTtcblxuXHRcdFx0XHRcdGlmICghaGFzaCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuX2hhc2hlc1toYXNoXSA9IGUuY29udGVudDtcblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcyksXG5cdFx0XHQnY2hhbmdlZC5vd2wuY2Fyb3VzZWwnOiAkLnByb3h5KGZ1bmN0aW9uKGUpIHtcblx0XHRcdFx0aWYgKGUubmFtZXNwYWNlICYmIGUucHJvcGVydHkubmFtZSA9PT0gJ3Bvc2l0aW9uJykge1xuXHRcdFx0XHRcdHZhciBjdXJyZW50ID0gdGhpcy5fY29yZS5pdGVtcyh0aGlzLl9jb3JlLnJlbGF0aXZlKHRoaXMuX2NvcmUuY3VycmVudCgpKSksXG5cdFx0XHRcdFx0XHRoYXNoID0gJC5tYXAodGhpcy5faGFzaGVzLCBmdW5jdGlvbihpdGVtLCBoYXNoKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtID09PSBjdXJyZW50ID8gaGFzaCA6IG51bGw7XG5cdFx0XHRcdFx0XHR9KS5qb2luKCk7XG5cblx0XHRcdFx0XHRpZiAoIWhhc2ggfHwgd2luZG93LmxvY2F0aW9uLmhhc2guc2xpY2UoMSkgPT09IGhhc2gpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaGFzaCA9IGhhc2g7XG5cdFx0XHRcdH1cblx0XHRcdH0sIHRoaXMpXG5cdFx0fTtcblxuXHRcdC8vIHNldCBkZWZhdWx0IG9wdGlvbnNcblx0XHR0aGlzLl9jb3JlLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgSGFzaC5EZWZhdWx0cywgdGhpcy5fY29yZS5vcHRpb25zKTtcblxuXHRcdC8vIHJlZ2lzdGVyIHRoZSBldmVudCBoYW5kbGVyc1xuXHRcdHRoaXMuJGVsZW1lbnQub24odGhpcy5faGFuZGxlcnMpO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgZXZlbnQgbGlzdGVuZXIgZm9yIGhhc2ggbmF2aWdhdGlvblxuXHRcdCQod2luZG93KS5vbignaGFzaGNoYW5nZS5vd2wubmF2aWdhdGlvbicsICQucHJveHkoZnVuY3Rpb24oZSkge1xuXHRcdFx0dmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHJpbmcoMSksXG5cdFx0XHRcdGl0ZW1zID0gdGhpcy5fY29yZS4kc3RhZ2UuY2hpbGRyZW4oKSxcblx0XHRcdFx0cG9zaXRpb24gPSB0aGlzLl9oYXNoZXNbaGFzaF0gJiYgaXRlbXMuaW5kZXgodGhpcy5faGFzaGVzW2hhc2hdKTtcblxuXHRcdFx0aWYgKHBvc2l0aW9uID09PSB1bmRlZmluZWQgfHwgcG9zaXRpb24gPT09IHRoaXMuX2NvcmUuY3VycmVudCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fY29yZS50byh0aGlzLl9jb3JlLnJlbGF0aXZlKHBvc2l0aW9uKSwgZmFsc2UsIHRydWUpO1xuXHRcdH0sIHRoaXMpKTtcblx0fTtcblxuXHQvKipcblx0ICogRGVmYXVsdCBvcHRpb25zLlxuXHQgKiBAcHVibGljXG5cdCAqL1xuXHRIYXNoLkRlZmF1bHRzID0ge1xuXHRcdFVSTGhhc2hMaXN0ZW5lcjogZmFsc2Vcblx0fTtcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIHBsdWdpbi5cblx0ICogQHB1YmxpY1xuXHQgKi9cblx0SGFzaC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBoYW5kbGVyLCBwcm9wZXJ0eTtcblxuXHRcdCQod2luZG93KS5vZmYoJ2hhc2hjaGFuZ2Uub3dsLm5hdmlnYXRpb24nKTtcblxuXHRcdGZvciAoaGFuZGxlciBpbiB0aGlzLl9oYW5kbGVycykge1xuXHRcdFx0dGhpcy5fY29yZS4kZWxlbWVudC5vZmYoaGFuZGxlciwgdGhpcy5faGFuZGxlcnNbaGFuZGxlcl0pO1xuXHRcdH1cblx0XHRmb3IgKHByb3BlcnR5IGluIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMpKSB7XG5cdFx0XHR0eXBlb2YgdGhpc1twcm9wZXJ0eV0gIT0gJ2Z1bmN0aW9uJyAmJiAodGhpc1twcm9wZXJ0eV0gPSBudWxsKTtcblx0XHR9XG5cdH07XG5cblx0JC5mbi5vd2xDYXJvdXNlbC5Db25zdHJ1Y3Rvci5QbHVnaW5zLkhhc2ggPSBIYXNoO1xuXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XG5cbi8qKlxuICogU3VwcG9ydCBQbHVnaW5cbiAqXG4gKiBAdmVyc2lvbiAyLjMuNFxuICogQGF1dGhvciBWaXZpZCBQbGFuZXQgU29mdHdhcmUgR21iSFxuICogQGF1dGhvciBBcnR1cyBLb2xhbm93c2tpXG4gKiBAYXV0aG9yIERhdmlkIERldXRzY2hcbiAqIEBsaWNlbnNlIFRoZSBNSVQgTGljZW5zZSAoTUlUKVxuICovXG47KGZ1bmN0aW9uKCQsIHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXG5cdHZhciBzdHlsZSA9ICQoJzxzdXBwb3J0PicpLmdldCgwKS5zdHlsZSxcblx0XHRwcmVmaXhlcyA9ICdXZWJraXQgTW96IE8gbXMnLnNwbGl0KCcgJyksXG5cdFx0ZXZlbnRzID0ge1xuXHRcdFx0dHJhbnNpdGlvbjoge1xuXHRcdFx0XHRlbmQ6IHtcblx0XHRcdFx0XHRXZWJraXRUcmFuc2l0aW9uOiAnd2Via2l0VHJhbnNpdGlvbkVuZCcsXG5cdFx0XHRcdFx0TW96VHJhbnNpdGlvbjogJ3RyYW5zaXRpb25lbmQnLFxuXHRcdFx0XHRcdE9UcmFuc2l0aW9uOiAnb1RyYW5zaXRpb25FbmQnLFxuXHRcdFx0XHRcdHRyYW5zaXRpb246ICd0cmFuc2l0aW9uZW5kJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YW5pbWF0aW9uOiB7XG5cdFx0XHRcdGVuZDoge1xuXHRcdFx0XHRcdFdlYmtpdEFuaW1hdGlvbjogJ3dlYmtpdEFuaW1hdGlvbkVuZCcsXG5cdFx0XHRcdFx0TW96QW5pbWF0aW9uOiAnYW5pbWF0aW9uZW5kJyxcblx0XHRcdFx0XHRPQW5pbWF0aW9uOiAnb0FuaW1hdGlvbkVuZCcsXG5cdFx0XHRcdFx0YW5pbWF0aW9uOiAnYW5pbWF0aW9uZW5kJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHR0ZXN0cyA9IHtcblx0XHRcdGNzc3RyYW5zZm9ybXM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCd0cmFuc2Zvcm0nKTtcblx0XHRcdH0sXG5cdFx0XHRjc3N0cmFuc2Zvcm1zM2Q6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdwZXJzcGVjdGl2ZScpO1xuXHRcdFx0fSxcblx0XHRcdGNzc3RyYW5zaXRpb25zOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuICEhdGVzdCgndHJhbnNpdGlvbicpO1xuXHRcdFx0fSxcblx0XHRcdGNzc2FuaW1hdGlvbnM6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gISF0ZXN0KCdhbmltYXRpb24nKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdGZ1bmN0aW9uIHRlc3QocHJvcGVydHksIHByZWZpeGVkKSB7XG5cdFx0dmFyIHJlc3VsdCA9IGZhbHNlLFxuXHRcdFx0dXBwZXIgPSBwcm9wZXJ0eS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHByb3BlcnR5LnNsaWNlKDEpO1xuXG5cdFx0JC5lYWNoKChwcm9wZXJ0eSArICcgJyArIHByZWZpeGVzLmpvaW4odXBwZXIgKyAnICcpICsgdXBwZXIpLnNwbGl0KCcgJyksIGZ1bmN0aW9uKGksIHByb3BlcnR5KSB7XG5cdFx0XHRpZiAoc3R5bGVbcHJvcGVydHldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVzdWx0ID0gcHJlZml4ZWQgPyBwcm9wZXJ0eSA6IHRydWU7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBwcmVmaXhlZChwcm9wZXJ0eSkge1xuXHRcdHJldHVybiB0ZXN0KHByb3BlcnR5LCB0cnVlKTtcblx0fVxuXG5cdGlmICh0ZXN0cy5jc3N0cmFuc2l0aW9ucygpKSB7XG5cdFx0LyoganNoaW50IC1XMDUzICovXG5cdFx0JC5zdXBwb3J0LnRyYW5zaXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCd0cmFuc2l0aW9uJykpXG5cdFx0JC5zdXBwb3J0LnRyYW5zaXRpb24uZW5kID0gZXZlbnRzLnRyYW5zaXRpb24uZW5kWyAkLnN1cHBvcnQudHJhbnNpdGlvbiBdO1xuXHR9XG5cblx0aWYgKHRlc3RzLmNzc2FuaW1hdGlvbnMoKSkge1xuXHRcdC8qIGpzaGludCAtVzA1MyAqL1xuXHRcdCQuc3VwcG9ydC5hbmltYXRpb24gPSBuZXcgU3RyaW5nKHByZWZpeGVkKCdhbmltYXRpb24nKSlcblx0XHQkLnN1cHBvcnQuYW5pbWF0aW9uLmVuZCA9IGV2ZW50cy5hbmltYXRpb24uZW5kWyAkLnN1cHBvcnQuYW5pbWF0aW9uIF07XG5cdH1cblxuXHRpZiAodGVzdHMuY3NzdHJhbnNmb3JtcygpKSB7XG5cdFx0LyoganNoaW50IC1XMDUzICovXG5cdFx0JC5zdXBwb3J0LnRyYW5zZm9ybSA9IG5ldyBTdHJpbmcocHJlZml4ZWQoJ3RyYW5zZm9ybScpKTtcblx0XHQkLnN1cHBvcnQudHJhbnNmb3JtM2QgPSB0ZXN0cy5jc3N0cmFuc2Zvcm1zM2QoKTtcblx0fVxuXG59KSh3aW5kb3cuWmVwdG8gfHwgd2luZG93LmpRdWVyeSwgd2luZG93LCBkb2N1bWVudCk7XG4iLCJpbXBvcnQgTmF2QmFyRml4ZWQgZnJvbSAnLi9jb21wb25lbnQvTmF2QmFyRml4ZWQnXG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgIG5ldyBOYXZCYXJGaXhlZChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbmF2YmFyJykpLnJ1bigpO1xufSk7XG5cblxuXG5pbXBvcnQgJy4vY29tcG9uZW50L2Nhcm91c2VsJzsiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBOYXZCYXJGaXhlZCB7XG5cbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50KSB7XG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICAgIHRoaXMuaCA9IGVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuICAgIH1cblxuICAgIGZpeGVkQmxvY2sgPSBlbGVtZW50ID0+IHtcbiAgICAgICAgaWYoJCh3aW5kb3cpLnNjcm9sbFRvcCgpID4gdGhpcy5oKXtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdmaXhlZCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2ZpeGVkJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcnVuKCkge1xuICAgICAgICAkKHdpbmRvdykuc2Nyb2xsKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZml4ZWRCbG9jayh0aGlzLmVsZW1lbnQpXG4gICAgICAgIH0pO1xuICAgIH1cbn0iLCJpbXBvcnQgJ293bC5jYXJvdXNlbCc7XG5cbmNvbnN0IGNhbGxiYWNrcyA9IChldmVudCkgPT57XG4gICAgLy8gY29uc29sZS5sb2coZXZlbnQpXG59O1xuXG5jb25zdCBvcHRpb25zID0ge1xuICAgIGxvb3A6dHJ1ZSxcbiAgICBpdGVtczoxLFxuICAgIG5hdjp0cnVlLFxuICAgIGRvdHM6IGZhbHNlLFxuICAgIGxhenlMb2FkOnRydWUsXG59O1xuXG5cbiQoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XG4gICAgY29uc3Qgb3dsID0gJCgnLm93bC1jYXJvdXNlbCcpO1xuICAgIG93bC5vd2xDYXJvdXNlbChvcHRpb25zKTtcblxuICAgIG93bC5vbignY2hhbmdlZC5vd2wuY2Fyb3VzZWwnLCBjYWxsYmFja3MpO1xuXG59KTsiXX0=
