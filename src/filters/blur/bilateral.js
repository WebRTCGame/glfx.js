/**
 * @filter           Gaussian Blur
 * @description      
 * @param radius     the radius of the filter
 * @param angle      the rotation of the bokeh in radians
 */
function bilateral() {
    gl.bilateral = gl.bilateral || new Shader(null, '                                                              \
        const float RADIUS = 8.0;                                                                                  \
                                                                                                                   \
        uniform sampler2D texture;                                                                                 \
        varying vec2 texCoord;                                                                                     \
        uniform vec2 texSize;                                                                                      \
        uniform float preserve;                                                                                    \
                                                                                                                   \
        void main() {                                                                                              \
            vec4 acc   = vec4(0.0);                                                                                \
            vec4 count = vec4(0.0);                                                                                \
            vec4 center = texture2D(texture, vec2(texCoord.x, texCoord.y));                                        \
            for (float i=-RADIUS; i<=RADIUS; i+=1.0) {                                                             \
              for (float j=-RADIUS; j<=RADIUS; j+=1.0) {                                                           \
                 vec4 tmp = texture2D(texture, vec2(texCoord.x + (j / texSize.x), texCoord.y + (i / texSize.y)));  \
                 vec4 diff = (center - tmp);                                                                       \
                 diff.w = 0.0;                                                                                     \
                 float diff_map = exp(-1.0 * dot(diff, diff) * preserve);                                          \
                 float gaussian_w = exp( -0.5 * (i*i + j*j) / RADIUS);                                             \
                 float weight = diff_map * gaussian_w;                                                             \
                 acc += tmp * weight;                                                                              \
                 count += weight;                                                                                  \
              }                                                                                                    \
            }                                                                                                      \
            gl_FragColor = acc / count;                                                                            \
        }                                                                                                          \
    ');

    // Remap the texture values, which will help make the bokeh effect
    simpleShader.call(this, gl.bilateral, {
        texSize: [this.width, this.height],
        preserve: 8.0
    });

    return this;
}
