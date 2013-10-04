/**
 * @filter         Comic
 * @description    Quantizes the image and overlays it with the edge found by
 *                 a difference of gaussian filter (in this case using a bilateral filter).
 * @param sigma    Standard deviation for the gaussian/bilateral blur
 */
function comic(sigma) {
    //Using bilateral filter for better results
    //It isn't working on mobile devices though (why the hell ever ...)
    var buffer = this.contents()._;
    this.denoise(sigma);
    this._.extraTexture.ensureFormat(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function() {
        Shader.getDefaultShader().drawRect();
    });
    this._.extraTexture.use(1);
    //Second biliteral filter
    this.denoise(sigma*1.6);
    
    //Now we're gonna subtract and threshold them to get the edges
    var fragment = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        varying vec2 texCoord;\
        \
        void main(void) {\
            vec4 color0 = texture2D(texture0, texCoord).rgba;\
            vec4 color1 = texture2D(texture1, texCoord).rgba;\
            color0 = color0 - color1;\
            if((color0.r <= 0.005) || (color0.g <= 0.005) || (color0.b <= 0.005)) {\
                color0.r = 1.0;\
                color0.g = 1.0;\
                color0.b = 1.0;\
                color0.a = 0.0;\
            } else {\
                color0.r = 0.0;\
                color0.g = 0.0;\
                color0.b = 0.0;\
                color0.a = 1.0;\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.differenceofgaussian = gl.differenceofgaussian || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.differenceofgaussian);
    
    this._.extraTexture.unuse(1);
    
    this.gaussian(5.0, 0.8);
    
    var buffer2 = this.contents()._; 
    
    this._.texture.swapWith(buffer);
    
    this.denoise(sigma).update(),
    
    this.brightnessQuantization(4).update();
    
    this.join(buffer2);
    
    this._.extraTexture.destroy();
    
    return this;
}