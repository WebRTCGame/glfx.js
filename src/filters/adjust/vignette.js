/**
 * @filter         Vignette
 * @description    Adds a simulated lens edge darkening effect.
 * @param size     0 to 1 (0 for center of frame, 1 for edge of frame)
 * @param amount   0 to 1 (0 for no effect, 1 for maximum lens darkening)
 * @param x        X offset in pixels, default 0
 * @param y        Y offset in pixels, default 0
 * @param width    Width of vignette in pixels, default canvas.width
 * @param height   Height of vignette in pixels, default canvas.height
 */
function vignette(size, amount, x, y, width, height) {
    gl.vignette = gl.vignette || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float size;\
        uniform float amount;\
        uniform vec2 offset;\
        uniform vec2 multiplier;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            \
            float dist = distance((texCoord * multiplier) + offset, vec2(0.5, 0.5));\
            color.rgb *= smoothstep(0.8, size * 0.8, dist * (amount + size));\
            \
            gl_FragColor = color;\
        }\
    ');
    
    x = x || 0;
    y = y || 0;
    width = width || this.width;
    height = height || this.height;

    simpleShader.call(this, gl.vignette, {
        size: clamp(0, size, 1),
        amount: clamp(0, amount, 1),
        offset: [x / width, y / height],
        multiplier: [this.width / width, this.height / height]
    });

    return this;
}
