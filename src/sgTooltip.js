/*  sgTooltip class.
 *  Produces a "tooltip" over elements from divs elsewhere in the document.
 *
 *  Requires (but doesn't check for) prototype 1.6. (http://prototypejs.org/)
 *  May work with earlier or later versions, up to you to test. :)
 *
 *  Copyright 2008-2009 Sam Graham.  http://www.illusori.co.uk/
 *  This work is licensed under a
 *  Creative Commons Attribution-Share Alike 2.0 UK: England & Wales License
 *  http://creativecommons.org/licenses/by-sa/2.0/uk/
 *  In human-readble terms: you're free to copy, distribute and modify
 *  providing you maintain attribution and licence.
 *
 *  Use at your own risk, no fitness for purpose implied, etc, etc.
 */

/*  Overview:
 *    There's two classes of objects involved:
 *      - sgTooltipHotspot:
 *        This is a hotspot that displays an associated tooltip(s) when
 *        you mouseover it.
 *      - sgTooltipStack:
 *        This is the stack of tooltips to display in a particular position,
 *        one of these is created for each position style of tooltip and it
 *        contains all the tooltips currently displayed in that position.
 */

//function db( x )
//{
//    $('log').value = x + '\n' + $('log').value;
//}

sgTooltip = {
    Version: '1.0.0.2',

    tooltipStacks: {},

    scanForTooltips: function()
        {
            var i, els;

            new sgTooltipStack( 'fixed' );
            new sgTooltipStack( 'elementRelative' );
            new sgTooltipStack( 'mouseRelative' );

            els = $$('.tooltip-hotspot');
            for( i = 0; i < els.length; i++ )
                new sgTooltipHotspot( els[ i ] );
        }

//  TODO:  removeTooltips

    };

sgTooltipHotspot = Class.create();

sgTooltipHotspot.prototype = {

    defaults: {
        /*  Can be mouse-relative, element-relative, fixed  */
        position:    'mouse-relative',
        /*  Can be vertical, horizontal, stack, none */
        stacking:    'vertical',
        x: 5,
        y: 5,
        /*  Which direction do we flip if we meet the edge of the window?  */
        flipX: true,
        flipY: false,
        /*  Do we temporarily suppress the title attribute of the target to
         *  avoid browser tooltip clash?
         */
        suppressTitle: true
        },

    getConfigValue: function( setting, type )
        {
            var value;

            /*  Grab the config from the sgtooltip namespace attributes if
             *  they exist, otherwise use our defaults.
             */
            value = this.hotspot.getAttribute( 'sgtooltip:' + setting );
            if( value === undefined || value === null )
                return( this.defaults[ setting ] );
            if( type == 'number' )
                return( parseFloat( value ) );
            if( type == 'boolean' )
                return( value == 'true' ? true : false );
            return( value );
        },

    initialize: function( el )
        {
            this.showing = false;

            this.hotspot = el;
            /*  Attach to the hotspot element so that we can be found again  */
            this.hotspot.tooltipHotspot = this;

            /*  Grab our tooltips  */
            this.tooltips = this.getConfigValue( 'tooltip', 'string' );
            this.tooltips = $($w(this.tooltips));

            /*  Extract our configuration values  */
            this.position = this.getConfigValue( 'position', 'string' );
            this.position = this.position.camelize();
            this.x        = this.getConfigValue( 'x', 'number' );
            this.y        = this.getConfigValue( 'y', 'number' );
            this.flipX    = this.getConfigValue( 'flipX', 'boolean' );
            this.flipY    = this.getConfigValue( 'flipY', 'boolean' );
this.stacking = this.getConfigValue( 'stacking', 'string' );

//  TODO: supress title

            /*  Set up our callback methods as "normal functions" suitable
             *  to be bound as an event listener.
             */
            this._eventMouseOver =
                this._mouseOver.bindAsEventListener( this );
            this._eventMouseOut  =
                this._mouseOut.bindAsEventListener( this );

            /*  Bind our mouseover and mouseout to the hotspot  */
            Event.observe( this.hotspot, 'mouseover',
                this._eventMouseOver, false );
            Event.observe( this.hotspot, 'mouseout',
                this._eventMouseOut,  false );
        },

    removeTooltip: function()
        {
            /*  Stop showing (if we are)  */
            this.hideTooltips();

            /*  Unbind our events  */
            Event.stopObserving( this.hotspot, 'mouseover',
                this._eventMouseOver, false );
            Event.stopObserving( this.hotspot, 'mouseout',
                this._eventMouseOut, false );

            /*  Lose tooltip references  */
            this.tooltips = null;

            /*  Finally, ensure that we remove the reference to us  */
            this.hotspot.tooltipHotspot = null;
            this.hotspot = null;
        },

    showTooltips: function()
        {
            if( this.showing )
                return;
            this.showing = true;
            sgTooltip.tooltipStacks[ this.position ].addHotspot( this );
        },
    hideTooltips: function()
        {
            if( !this.showing )
                return;
            this.showing = false;
            sgTooltip.tooltipStacks[ this.position ].removeHotspot( this );
        },

    _mouseOver: function( e )
        {
            sgTooltip.tooltipStacks[ this.position ].updateMouse( e );
            this.showTooltips();
        },
    _mouseOut: function( e )
        {
            var el     = Event.element( e );
            var elTo = e.relatedTarget || e.toElement;

            while( elTo && elTo !== this.hotspot && elTo.nodeName != 'BODY' )
                elTo = elTo.parentNode;

//  TODO: allow mouse over tooltips themselves.

            if( elTo === this.hotspot )
                return;

            sgTooltip.tooltipStacks[ this.position ].updateMouse( e );
            this.hideTooltips();
        }

    };

sgTooltipStack = Class.create();

sgTooltipStack.prototype = {

    initialize: function( position )
        {
            this.watching = false;
            this.mouseX   = -1;
            this.mouseY   = -1;

            this.position = position;
            this.hotspots = new Array();
            this.tooltipData = $H();

            this.floatDiv = document.createElement( 'div' );
            $(this.floatDiv).setStyle(
                {
//border: 'thick yellow solid',
                    position: 'fixed'
                } );
            //  apply a class to floatDiv allowing styling.
            this.floatDiv.addClassName( 'sgtooltip-float' );
            this.floatDiv.hide();
            document.body.appendChild( this.floatDiv );

            this.stackDiv = document.createElement( 'div' );
            $(this.stackDiv).setStyle(
                {
//border: 'thick green solid',
                    position: 'static'
                } );
            //  apply a class to stackDiv allowing styling.
            this.stackDiv.addClassName( 'sgtooltip-stack' );
            this.floatDiv.appendChild( this.stackDiv );

            sgTooltip.tooltipStacks[ position ] = this;

            /*  Set up our callback methods as "normal functions" suitable
             *  to be bound as an event listener.
             */
            this._eventMouseMove =
                this._mouseMove.bindAsEventListener( this );
        },

    addTooltipForHotspot: function( tooltip, hotspot )
        {
            var ttd, containerDiv;

            tooltip = $(tooltip);

            if( ttd = this.tooltipData.get( tooltip.id ) )
            {
                if( !$A(ttd.hotspots).member( hotspot ) )
                    ttd.hotspots.push( hotspot );
            }
            else
            {
                /*  Store initial state of tooltip  */
                this.tooltipData.set( tooltip.id, {
                    visible: tooltip.visible(),
                    parent: tooltip.parentNode,
                    hotspots: [ hotspot ]
                    } );

                containerDiv = document.createElement( 'div' );
                $(containerDiv).setStyle( {
                    padding: '0px',
                    margin:  '0px',
                    border: 'none'
                    } );
                //  apply a class to containerDiv allowing styling.
                containerDiv.addClassName( 'sgtooltip-container' );

                tooltip.hide();
                containerDiv.appendChild( tooltip );

                /*  Calculate style according to stacking  */
                switch( hotspot.stacking )
                {
                case 'horizontal':
                    containerDiv.setStyle( {
                        display:    'inline-block',
                        position:   'static',
                        marginLeft: hotspot.x + 'px',
                        marginTop:  hotspot.y + 'px'
                        } );
                    break;
                case 'stacked':
                    containerDiv.setStyle( {
                        display:    'block',
                        position:   'absolute',
                        /*  TODO: sum up previous tip margins  */
                        marginLeft: hotspot.x + 'px',
                        marginTop:  hotspot.y + 'px'
                        } );
                case 'vertical':
                default:
                    containerDiv.setStyle( {
                        display:    'block',
                        position:   'static',
                        marginLeft: hotspot.x + 'px',
                        marginTop:  hotspot.y + 'px'
                        } );
                    break;
                }
                this.stackDiv.appendChild( containerDiv );
                tooltip.show();
            }
        },

    addHotspot: function( hotspot )
        {
            var i, pos;

//db( 'addHotspot' );

            if( $A(this.hotspots).member( hotspot ) )
                return;

            this.hotspots[ this.hotspots.length ] = hotspot;
            for( i = 0; i < hotspot.tooltips.length; i++ )
                this.addTooltipForHotspot( hotspot.tooltips[ i ], hotspot );

            /*  if we were empty: show floatDiv, start watching  */
            if( this.hotspots.length == 1 )
            {
                this.floatDiv.show();
                this.startWatching();
            }

            /*  Need to redraw in case we've flipped or something  */
            this.redrawTooltipStack();
        },

    removeTooltipForHotspot: function( tooltip, hotspot )
        {
            var ttd, containerDiv;

            tooltip = $(tooltip);

            ttd = this.tooltipData.get( tooltip.id );
            if( !ttd )
                return;

            /*  Remove the hotspot from the list of hotspots adding
             *  this tooltip.
             */
            ttd.hotspots = $A(ttd.hotspots).findAll(
                function( entry ) { return( entry !== hotspot ); } );

            /*  If other hotspots need us, we're done  */
            if( ttd.hotspots.length )
                return;

            containerDiv = tooltip.parentNode;

            /*  Restore initial state of tooltip  */
            tooltip.hide();
            ttd.parent.appendChild( tooltip );
            this.stackDiv.removeChild( containerDiv );
            if( ttd.visible )
                tooltip.show();

            this.tooltipData.unset( tooltip.id );
        },

    removeHotspot: function( hotspot )
        {
            var i;

//db( 'removeHotspot' );
            this.hotspots = $A(this.hotspots).findAll(
                function( entry ) { return( entry !== hotspot ); } );
            for( i = 0; i < hotspot.tooltips.length; i++ )
                this.removeTooltipForHotspot( hotspot.tooltips[ i ], hotspot );

            /*  If we're now empty: hide floatDiv, stop watching  */
            if( this.hotspots.length < 1 )
            {
                this.floatDiv.hide();
                this.stopWatching();
            }

            /*  Need to redraw in case we've flipped or something  */
            this.redrawTooltipStack();
        },

    redrawTooltipStack: function()
        {
            var x, y, dim, viewportDim, viewportOffsets, vX, vY;

//db( 'redrawTooltipStack' );

            if( this.hotspots.length < 1 )
                return;

            viewportDim = document.viewport.getDimensions();
            viewportOffsets = document.viewport.getScrollOffsets();

            vX = viewportDim.width + viewportOffsets.left;
            vY = viewportDim.height + viewportOffsets.top;

            /*  TODO: figure out our x and y point  */
            switch( this.position )
            {
            case 'fixed':
                /*  TODO: figure out fixed position  */
//                x = viewportOffsets.left + 5;
//                y = viewportOffsets.top + 5;
                x = vX - 5;
                y = vY - 5;
                break;
            case 'element-relative':
                x = this.mouseX + 5;
                y = this.mouseY + 5;
                break;
            case 'mouse-relative':
            default:
                x = this.mouseX + 5;
                y = this.mouseY + 5;
                break;
            }

            /*  Figure out our bounds  */
            dim = this.floatDiv.getDimensions();

//$('dimX').value = dim.width;
//$('dimY').value = dim.height;

            /*  See if we need to flip and/or slide  */
//$('viewportX').value = vX;
//$('viewportY').value = vY;
            if( x + dim.width >= vX - this.hotspots[ 0 ].x )
            {
                if( this.hotspots[ 0 ].flipX )
                    x = x - dim.width - 5 - this.hotspots[ 0 ].x;
                else
                    x = vX - dim.width - this.hotspots[ 0 ].x;
            }
            if( y + dim.height >= vY - this.hotspots[ 0 ].y )
            {
                if( this.hotspots[ 0 ].flipY )
                    y = y - dim.height - 5 - this.hotspots[ 0 ].y;
                else
                    y = vY - dim.height - this.hotspots[ 0 ].y;
            }

            x -= viewportOffsets.left;
            y -= viewportOffsets.top;

//$('tooltipX').value = x;
//$('tooltipY').value = y;

            /*  Reposition ourselves  */
            this.floatDiv.setStyle(
                {
                    position: 'fixed',
                    left: x + 'px',
                    top:  y + 'px'
                } );
        },

    startWatching: function()
        {
            if( this.watching || this.position != 'mouseRelative' )
                return;
            Event.observe( document, 'mousemove',
                this._eventMouseMove, false );
            this.watching = true;
//$('watching').value = 'yes';
        },
    stopWatching: function()
        {
            if( !this.watching )
                return;
            Event.stopObserving( document, 'mousemove',
                this._eventMouseMove, false );
            this.watching = false;
//$('watching').value = 'no';
        },

    updateMouse: function( e )
        {
            var pos;

            pos = Event.pointer( e );

            if( pos.x == this.mouseX && pos.y == this.mouseY )
                return( false );

            this.mouseX = pos.x;
            this.mouseY = pos.y;

//$('mouseX').value = this.mouseX;
//$('mouseY').value = this.mouseY;

            return( true );
        },

    _mouseMove: function( e )
        {
            if( this.updateMouse( e ) )
                this.redrawTooltipStack();
        }

    };

if( document.loaded )
    sgTooltip.scanForTooltips();
else
    Event.observe( document, 'dom:loaded', sgTooltip.scanForTooltips, false );

