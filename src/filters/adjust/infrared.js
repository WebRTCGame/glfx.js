/**
 * @filter         Infrared
 * @description    Simulates infrared photography.
 * @param amount   0 to 1 (0 for no effect, 1 for full effect)
 */
function infrared(amount) {
    gl.infrared = gl.infrared || new Shader(null, '\
        uniform sampler2D texture;\
        uniform float amount;\
        uniform vec2 texSize;\
        varying vec2 texCoord;\
        void main() {\
            vec4 color = texture2D(texture, texCoord);\
            vec4 orig = color;\
            \
            float dx = 1.0 / texSize.x;\
            float dy = 1.0 / texSize.y;\
            \
            /* Mix channels, favoring green */\
            float mix = (-color.r * 0.5) + (color.g * 2.25) + (-color.b * 0.5);\
            color.rgb = vec3(mix);\
            \
            /* Add in some color from original */\
            color = (color * 0.75) + (orig * 0.25);\
            \
            gl_FragColor = color;\
        }\
    ');

    simpleShader.call(this, gl.infrared, {
        amount: clamp(0, amount, 1),
        texSize: [this._.texture.width, this._.texture.height]
    });

    return this;
}
