import { buildProgramFromSources, loadShadersFromURLS, loadJSONFile, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js';
import * as TORUS from '../../libs/objects/torus.js';



function setup(shaders, sceneGraph) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    /** @type WebGL2RenderingContext */
    let gl = setupWebGL(canvas);

    // Drawing mode (gl.LINES or gl.TRIANGLES)
    let mode = gl.LINES;

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-1 * aspect, aspect, -1, 1, 0.01, 3);
    let mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);

    let zoom = 1.0;

    //recursivo para encontrar o no
    function findNode(name, node) {
        if (node.name === name) {
            return node;
        }
        for (let child of node.children) {
            let result = findNode(name, child);
            if (result) {
                return result;
            }
        }
        return null;
    }

    const cabinNode = findNode("cabin", sceneGraph);
    const cannonNode = findNode("cannon", sceneGraph);
    const wheelNode = findNode("wheel", sceneGraph);


    /** Model parameters */
    let ag = 0;
    let rg = 0;
    let rb = 0;
    let rc = 0;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function (event) {
        switch (event.key) {
            case '1':
                // Front view
                mView = lookAt([0, 0.6, 1], [0, 0.6, 0], [0, 1, 0]);
                break;
            case '2':
                // Top view
                mView = lookAt([0, 1.6, 0], [0, 0.6, 0], [0, 0, -1]);
                break;
            case '3':
                // Right view
                mView = lookAt([1, 0.6, 0.], [0, 0.6, 0], [0, 1, 0]);
                break;
            case '4':
                mView = lookAt([2, 1.2, 1], [0, 0.6, 0], [0, 1, 0]);
                break;
            case '9':
                mode = gl.LINES;
                break;
            case '0':
                mode = gl.TRIANGLES;
                break;
            case 'p':
                ag = Math.min(0.050, ag + 0.005);
                break;
            case 'o':
                ag = Math.max(0, ag - 0.005);
                break;
            case 'q':
                wheelNode.transform.rotation[0] += 1;
                break;
            case 'e':
                wheelNode.transform.rotation[0] -= 1;
                break;
            case 'w':
                //roda canhao para cima (eixo X)
                cannonNode.transform.rotation[0] = Math.min(110, cannonNode.transform.rotation[0] + 1);
                break;
            case 's':
                //roda canhao para baixo (eixo X)
                cannonNode.transform.rotation[0] = Math.max(70, cannonNode.transform.rotation[0] - 1);
                break;
            case 'a':
                //roda cabine para esquerda (eixo Y)
                cabinNode.transform.rotation[1] -= 1;
                break;
            case 'd':
                //roda cabine para direita (eixo Y)
                cabinNode.transform.rotation[1] += 1;
                break;
            case '+':
                zoom /= 1.1;
                break;
            case '-':
                zoom *= 1.1;
                break;
        }
    }

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    CUBE.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);

    window.requestAnimationFrame(render);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mProjection = ortho(-aspect * zoom, aspect * zoom, -zoom, zoom, 0.01, 3);
    }

    const primitives = {
        "CUBE": CUBE,
        "CYLINDER": CYLINDER,
        "TORUS": TORUS
    }

    //para cada no
    function traverse(node) {
        //mete
        pushMatrix();
        //transformacoes na ordem certa
        const t = node.transform.translation;
        const r = node.transform.rotation;
        const s = node.transform.scale;
        multTranslation(t);
        multRotationZ(r[2]);
        multRotationY(r[1]);
        multRotationX(r[0]);
        multScale(s);
        //no e primitaiva -> desenhar
        if (node.primitive) {
            const primitive = primitives[node.primitive];
            uploadModelView();
            primitive.draw(gl, program, mode);
        }
        //vai buscar todos os filhos
        for (let child of node.children) {
            traverse(child);
        }
        //restaura
        popMatrix();
    }

    function uploadProjection() {
        uploadMatrix("u_projection", mProjection);
    }

    function uploadModelView() {
        uploadMatrix("u_model_view", modelView());
    }

    function uploadMatrix(name, m) {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, flatten(m));
    }

    function render() {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        // Send the mProjection matrix to the GLSL program
        mProjection = ortho(-aspect * zoom, aspect * zoom, -zoom, zoom, 0.01, 3);
        uploadProjection(mProjection);

        // Load the ModelView matrix with the Worl to Camera (View) matrix
        loadMatrix(mView);

        traverse(sceneGraph);
    }
}

const shader_urls = ["shader.vert", "shader.frag"];
const scene_url = "scene.json";

loadShadersFromURLS(shader_urls).then(shaders => {
    loadJSONFile(scene_url).then(sceneData => {
        setup(shaders, sceneData);
    });
});