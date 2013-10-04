/**
 * @filter         Brightness quantization
 * @description    Quick & dirty implementation of a quantization algorithm, that groups
 *                 colors by their brightness.
 * @param steps    The amount of steps in brightness.
 */
function brightnessQuantization(steps) {
    var fragment = '\
        uniform sampler2D texture;\
        varying vec2 texCoord;\
        vec3 rgb2hsv(vec3 rgb) {\
            float r = rgb.r;\
            float g = rgb.g;\
            float b = rgb.b;\
            float minch = min(r, min(g, b));\
            float maxch = max(r, max(g, b));\
            float h = 0.0;\
            float s = 0.0;\
            float v = maxch;\
            float d = maxch-minch;\
            if (d != 0.0) {\
                s = d/v;\
                if (r==v) {\
                    h = (g-b)/d;\
                } else if (g == v) {\
                    h = 2.0 + (b - r)/d;\
                } else {\
                    h = 4.0 + (r - g)/d;\
                }\
           }\
           return vec3(h, s, v);\
        }\
        vec3 hsv2rgb(vec3 hsv) {\
            vec3 rgb;\
            float h = hsv.x;\
            float s = hsv.y;\
            float v = hsv.z;\
            float i = floor(h);\
            float f = h-i;\
            float p = (1.0-s);\
            float q = (1.0-s*f);\
            float t = (1.0-s*(1.0-f));\
            if (i == 0.0) {\
                rgb = vec3(1.0, t, p);\
            } else if (i == 1.0) {\
                rgb = vec3(q, 1.0, p);\
            } else if (i == 2.0) {\
                rgb = vec3(p, 1.0, t);\
            } else if (i == 3.0) {\
                rgb = vec3(p, q, 1.0);\
            } else if (i == 4.0) {\
                rgb = vec3(t, p, 1.0);\
            } else {\
                rgb = vec3(1.0, p, q);\
            }\
            rgb *= v;\
            return rgb;\
        }\
        \
        void main(void) {\
            vec3 hsv = rgb2hsv(texture2D(texture, texCoord).rgb);\
            float v = hsv.z;\
            float step = 1.0/float('+steps+');\
            for(int i = 0; i < '+steps+'; i+=1) {\
                float min = step*float(i);\
                float max = step*float(i+1);\
                if((v >= min) && (v <= max)) {\
                    if(abs(v-min) <= abs(max-v)) {\
                        v = min;\
                    } else {\
                        v = max;\
                    }\
                }\
            }\
            hsv.z = v;\
            vec3 rgb = hsv2rgb(hsv);\
            gl_FragColor = vec4(rgb, 1.0);\
        }\
    ';
    
    gl.brightnessquantizationshader = gl.brightnessquantizationshader || new Shader(null, fragment);
    simpleShader.call(this, gl.brightnessquantizationshader);
    
    return this;
}