#version 300 es

uniform mat4 u_model_view;
uniform mat4 u_projection;

in vec4 a_position;
in vec3 a_normal;

out vec3 v_normal;

void main() {
    gl_Position = u_projection * u_model_view * a_position;
    v_normal = a_normal;
}