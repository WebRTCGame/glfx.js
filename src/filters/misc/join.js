/**
 * @filter         Join
 * @description    Joins the image with a given black and white layer.
 *                 This is a quick and dirty implementation for the comic filter.
 * @param texture  Black and white image (where white->transparent and black->opaque)
 */
 
function join(texture) {
    
    texture.use(1);
    
    var fragment = '\
        uniform sampler2D texture0;\
        uniform sampler2D texture1;\
        varying vec2 texCoord;\
        \
        void main(void) {\
            vec4 color0 = texture2D(texture0, texCoord).rgba;\
            vec4 color1 = texture2D(texture1, texCoord).rgba;\
            vec3 grey = vec3(color1.r*0.3+color1.g*0.59+color1.b*0.11);\
            if(grey.r < 0.01) {\
                color0 = vec4(grey, 1.0);\
            }\
            gl_FragColor = color0;\
        }\
    ';
    
    gl.joinlayers = gl.joinlayers || new Shader(null, fragment).textures({ texture1: 1 });
    simpleShader.call(this, gl.joinlayers);
    
    this._.extraTexture.unuse(1);
    this._.extraTexture.destroy();
    
    texture.destroy();
    
    return this;
}