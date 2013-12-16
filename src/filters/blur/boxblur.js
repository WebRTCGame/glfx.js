/**
 * @filter           Gaussian Blur
 * @description      
 * @param radius     the radius of the filter
 * @param angle      the rotation of the bokeh in radians
 */
function boxblur() {
    gl.HBlur = gl.HBlur || new Shader(null, '                                 \
        const float RADIUS = 3.0;                                             \
                                                                              \
        uniform sampler2D texture;                                            \
        varying vec2 texCoord;                                                \
        uniform vec2 texSize;\
                                                                              \
        void main() {                                                         \
            vec4 color = vec4(0.0);                                           \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                        \
              color += texture2D(texture, vec2(texCoord.x + (i / texSize.x), texCoord.y));  \
            }                                                                 \
            gl_FragColor = color / (2.0 * RADIUS + 1.0);                      \
        }                                                                     \
    ');

    gl.VBlur = gl.VBlur || new Shader(null, '                                 \
        const float RADIUS = 3.0;                                             \
                                                                              \
        uniform sampler2D texture;                                            \
        varying vec2 texCoord;                                                \
        uniform vec2 texSize;\
                                                                              \
        void main() {                                                         \
            vec4 color = vec4(0.0);                                           \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                        \
              color += texture2D(texture, vec2(texCoord.x, texCoord.y + (i / texSize.y)));  \
            }                                                                 \
            gl_FragColor = color / (2.0 * RADIUS + 1.0);                      \
        }                                                                     \
    ');

    // Remap the texture values, which will help make the bokeh effect
    simpleShader.call(this, gl.HBlur, {
        texSize: [this.width, this.height]
    });

    simpleShader.call(this, gl.VBlur, {
        texSize: [this.width, this.height]
    });

    return this;
}
