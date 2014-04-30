
var Glitch = function(canvas, texture) {
    
    var gl = canvas._.gl;
    
    // draw texture on canvas　in advance for reading pixels from canvas.
    canvas.draw(texture);
    
    // reduce cost for getting pixel array each time
    var packPixels = canvas.getPixelArray();
    var packWidth;
    var packHeight;
    var packFormat;
    var packType;
    var pixelProcesser;
    
    this.width = function(w) {
        
        w = w || texture._.width;
        packWidth = w;
        
        return this;
    };
    
    this.height = function(h) {
        
        h = h || texture._.height;
        packHeight = h;
        
        return this;
    };
    
    this.shortenX = function(x) {
        
        x = x || 0;
        packWidth = texture._.width - x;
        
        return this;
    };
    
    this.shortenY = function(y) {
        
        y = y || 0;
        packHeight = texture._.height - y;
        
        return this;
    };
    
    this.type = function(type) {
        
        switch (type) {
            
            case exports.UNSIGNED_BYTE:
            case exports.UNSIGNED_SHORT_5_6_5:
            case exports.UNSIGNED_SHORT_4_4_4_4:
            case exports.UNSIGNED_SHORT_5_5_5_1:
                packType = type;
                break;
                
            default:
                console.log('[GLITCH TYPE ERROR] type supports only fx.UNSIGNED_BYTE, fx.UNSIGNED_SHORT_5_6_5, fx.UNSIGNED_SHORT_4_4_4_4, fx.UNSIGNED_SHORT_5_5_5_1.');
                break;
        };
        
        return this;
    };
    
    this.format = function(format) {
        
        switch (format) {
            
            case exports.ALPHA:
            case exports.LUMINANCE:
            case exports.LUMINANCE_ALPHA:
            case exports.RGB:
            case exports.RGBA:
                packFormat = format;
                break;
                
            default:
                console.log('[GLITCH FORMAT ERROR] format supports only fx.ALPHA, fx.LUMINANCE, fx.LUMINANCE_ALPHA, fx.RGB and fx.RGBA.');
                break;
        };
        
        return this;
    };
    
    this.offset = function(offset) {
        
        var a = packPixels.subarray(0, offset);
        var b = packPixels.subarray(offset, packPixels.length);
        var t = new Uint8Array(packPixels.length);
        var j = 0;
        
        for (var i = 0; i < b.length; i++) {
            t[j] = b[i];
            j++;
        }
        
        for (var i = 0; i < a.length; i++) {
            t[j] = a[i];
            j++;
        }
        
        packPixels = t;
        
        return this;
    };
    
    this.length = function() {
        
        return packPixels.length();
    };
    
    this.process = function(fn) {
        
        pixelProcesser = fn || function() {};
        
        return this;
    };
    
    this.update = function() {
        
        packWidth = packWidth || texture._.width;
        packHeight = packHeight || texture._.height;
        packFormat = packFormat || exports.RGBA;
        packType = packType || exports.UNSIGNED_BYTE;
        
        // handling pixel array
        pixelProcesser = pixelProcesser || function(pixels){};
        pixelProcesser(packPixels);
        
        gl.bindTexture(gl.TEXTURE_2D, texture._.id);
        gl.texImage2D(gl.TEXTURE_2D, 0, packFormat, packWidth, packHeight, 0, packFormat, packType, packPixels);
        canvas.draw(texture).update();
        
        return this;
    };
};

function glitch(texture) {
	return new Glitch(this, texture);
}
