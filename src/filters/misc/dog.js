//Returns the edges of the image with a transparent background.
//Will be used for a comic filter
function dog(sigma) {
    //Using biliteral filter for better results
    //It isn't working on mobile devices though (why the hell ever ...)
    this.denoise(sigma).update();
    this._.extraTexture.ensureFormat(this._.texture);
    this._.texture.use();
    this._.extraTexture.drawTo(function() {
        Shader.getDefaultShader().drawRect();
    });
    this._.extraTexture.use(1);
    //Second biliteral filter
    this.denoise(sigma*1.6).update();
    
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
            color0.a = 1.0;\
            if((color0.r <= 0.005) || (color0.g <= 0.005) || (color0.b <= 0.005)) {\
                color0.r = 1.0;\
                color0.g = 1.0;\
                color0.b = 1.0;\
                color0.a = 0.0;\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.differenceofgaussian = gl.differenceofgaussian || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.differenceofgaussian);
    
    this._.extraTexture.unuse(1);
    
    //Free the memory
    this._.extraTexture.destroy();
    
    return this;
}