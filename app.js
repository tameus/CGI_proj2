import { buildProgramFromSources, loadShadersFromURLS, loadJSONFile, setupWebGL } from "./libs/utils.js";
import { ortho, perspective, lookAt, flatten, mat4, vec4, mult, inverse } from "./libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix } from "./libs/stack.js";

import * as CUBE from './libs/objects/cube.js';
import * as CYLINDER from './libs/objects/cylinder.js';
import * as TORUS from './libs/objects/torus.js';
import * as SPHERE from './libs/objects/sphere.js';
import * as BUNNY from './libs/objects/bunny.js';
import * as COW from './libs/objects/cow.js';

function setup(shaders, sceneGraph) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    /** @type WebGL2RenderingContext */
    let gl = setupWebGL(canvas);

    // 0 -> linhas, 1-> preenchido, 2-> ambos
    let drawingMode = 2;

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
    let uColorLocation = gl.getUniformLocation(program, "u_color");
    let mProjection = ortho(-1 * aspect, aspect, -1, 1, -100, 200);

    let zoom = 1.0;

    let rg = 0;
    let tankPos_Z = 0;
    let rc = 0;
    let rb = 0;
    const WHEEL_RADIUS = 0.08;
    const Z_INCREMENT = 0.07;
    const ROTATION_INCREMENT = (Z_INCREMENT * 360) / (2 * Math.PI * WHEEL_RADIUS);

    let isPerspective = false;
    let isMultiView = false;
    let currentViewID = 1;
    const mViewFront = lookAt([2, 0.6, 0], [0, 0.6, 0], [0, 1, 0]);
    const mViewTop = lookAt([0, 2, 0], [0, 0.6, 0], [-1, 0, 0]);
    const mViewLeft = lookAt([0, 0.6, 2], [0, 0.6, 0], [0, 1, 0]);

    let mViewAxonometric;
    let isView4Oblique = false;

    let obliqueL = 0.5;
    let obliqueAlpha = 45.0;

    let axonometricAzimuth = 75.0;
    let axonometricElevation = 10.0;
    let axonometricDist = 10.0;

    const view4At = [0, 0.6, 0];
    const view4Up = [0, 1, 0];

    let projectiles = [];
    let shootRequested = false;
    const SHOOT_VELOCITY = 4;
    //gravidade em Y
    const G = [0.0, -1, 0.0];
    //ponta canhao
    const TIP = vec4(0, 0, 1.15, 1);
    //direcao canhao
    const TIP_DIR = vec4(0, 0, 1.0, 0);
    let projectileType = 'tomato';

    const COW_SIZE = 0.5;
    const TANK_SIZE = 0.5;
    const MIN_AREA = -5.0;
    const MAX_AREA = 5.0;

    //Minigame1 (atropelar)
    let isGameActive1 = false;
    let cowsToHit = 0;
    let cowsHitted = 0;
    let currentCowActive = false;
    let cowZ = 0.0;

    //Minigame2 (fugir)
    let isGameActive2 = false;
    let enemies = [];
    let survivalTime = 0;
    let spawnTimer = 0;
    const SPAWN_INTERVAL = 6.0;
    const ENEMY_SPEED = 0.5;
    let sensibleMode = false;

    let gameTimer1 = 0;

    //HTML
    const game1 = document.getElementById("game1");
    const cows1 = document.getElementById("cows1");
    const timer1 = document.getElementById("timer1");

    const game2 = document.getElementById("game2");
    const record2 = document.getElementById("record2");
    const timer2 = document.getElementById("timer2");
    let currentRecord = 0.0;

    const sensContainer = document.getElementById("sens");
    const sensState = document.getElementById("sens_state");


    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function (event) {
        switch (event.key) {
            case '0':
                //altera modo de vista 
                isMultiView = !isMultiView;
                break;
            case '1':
                //vista frontal
                currentViewID = 1;
                isMultiView = false;
                break;
            case '2':
                ///vista para esquerda
                currentViewID = 2;
                isMultiView = false;
                break;
            case '3':
                //vista para cima
                currentViewID = 3;
                isMultiView = false;
                break;
            case '4':
                //vista obliqua
                currentViewID = 4;
                isMultiView = false;
                break;
            case '8':
                //trocar entre obliqua e axonometrica
                isView4Oblique = !isView4Oblique;
                break;
            case '9':
                isPerspective = !isPerspective;
                break;
            case ' ':
                drawingMode = (drawingMode + 1) % 3;
                break;
            case 'ArrowLeft':
                if (currentViewID === 4 && isView4Oblique) {
                    //diminui alpha
                    obliqueAlpha -= 1;
                } else if (currentViewID === 4 && !isView4Oblique) {
                    //diminui rotacao Y
                    axonometricAzimuth -= 1;
                }
                event.preventDefault();
                break;
            case 'ArrowRight':
                if (currentViewID === 4 && isView4Oblique) {
                    //aumenta alpha
                    obliqueAlpha += 1;
                } else if (currentViewID === 4 && !isView4Oblique) {
                    //aumenta rotacao Y
                    axonometricAzimuth += 1;
                }
                event.preventDefault();
                break;
            case 'ArrowUp':
                if (currentViewID === 4 && isView4Oblique) {
                    //aumenta l
                    obliqueL = Math.min(2.0, obliqueL + 0.1);
                } else if (currentViewID === 4 && !isView4Oblique) {
                    //aumenta rotacao X
                    axonometricElevation = Math.min(89.0, axonometricElevation + 1);
                }
                event.preventDefault();
                break;
            case 'ArrowDown':
                if (currentViewID === 4 && isView4Oblique) {
                    //diminui l
                    obliqueL = Math.max(0.1, obliqueL - 0.1);
                } else if (currentViewID === 4 && !isView4Oblique) {
                    //diminui rotacao X
                    axonometricElevation = Math.max(-89.0, axonometricElevation - 1);
                }
                event.preventDefault();
                break;
            case 'q':
                //avancar
                rg += ROTATION_INCREMENT;
                tankPos_Z += Z_INCREMENT;
                break;
            case 'e':
                //retroceder
                rg -= ROTATION_INCREMENT;
                tankPos_Z -= Z_INCREMENT;
                break;
            case 'w':
                //canhao up
                rc = Math.min(30, rc + 1);
                break;
            case 's':
                //canhao down
                rc = Math.max(0, rc - 1);
                break;
            case 'a':
                //esquerda
                rb = Math.max(-100, rb - 2);
                break;
            case 'd':
                //direita
                rb = Math.min(100, rb + 2);
                break;
            case 'z':
                //disparar
                shootRequested = true;
                break;
            case 'v':
                //mudar tipo projetil
                if (projectileType === 'tomato') {
                    projectileType = 'rabbit';
                } else {
                    projectileType = 'tomato';
                }
                break;
            case 'r':
                //restaurar tudo
                zoom = 1.0;
                isPerspective = false;
                isView4Oblique = false;
                obliqueL = 0.5;
                obliqueAlpha = 45.0;
                axonometricAzimuth = 75.0;
                axonometricElevation = 10.0;
                axonometricDist = 10.0;
                rg = 0;
                tankPos_Z = 0;
                rb = 0;
                rc = 0;
                endMiniGame1();
                endMiniGame2();
                break;
            case 'm':
                //minijogo 1
                if (!isGameActive1) {
                    startMiniGame1();
                    endMiniGame2();
                } else {
                    endMiniGame1();
                }

                break;
            case 'n':
                //minijogo 2
                if (!isGameActive2) {
                    startMiniGame2();
                    endMiniGame1();
                } else {
                    endMiniGame2();
                }
                break;
            case 'b':
                //sensibilidade
                sensibleMode = !sensibleMode;
                if (sensibleMode) {
                    sensState.innerText = "ATIVADA";
                    sensContainer.classList.add("sensible_active");
                } else {
                    sensState.innerText = "DESATIVADA";
                    sensContainer.classList.remove("sensible_active");
                }
                break;

            case 'h':
                const controlElement = document.getElementById('lower-container');

                if (controlElement) {
                    controlElement.classList.toggle('hidden');
                    event.preventDefault();
                }
                return;
        }

    }

    //zoom
    canvas.addEventListener("wheel", function (event) {
        event.preventDefault();
        let zoomAmount;
        if (event.deltaY > 0) {
            zoomAmount = 1.1;
        } else {
            zoomAmount = 0.9;
        }
        zoom *= zoomAmount;
        zoom = Math.max(0.1, Math.min(zoom, 20.0));
    });

    gl.clearColor(0.53, 0.81, 0.92, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    CUBE.init(gl);
    CYLINDER.init(gl);
    TORUS.init(gl);
    SPHERE.init(gl);
    BUNNY.init(gl);
    COW.init(gl);

    game1.style.display = "none";
    game2.style.display = "none";

    window.requestAnimationFrame(render);

    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

    }

    const primitives = {
        "CUBE": CUBE,
        "CYLINDER": CYLINDER,
        "TORUS": TORUS,
        "SPHERE": SPHERE,
        "BUNNY": BUNNY,
        "COW": COW
    }

    function getMode(modeID) {
        if (modeID === 0) {
            return gl.LINES;
        } else {
            return gl.TRIANGLES;
        }
    }

    function drawPrimitiveInBothModes(primitive, fillColor) {
        //preenchimento
        gl.uniform4fv(uColorLocation, fillColor);
        primitive.draw(gl, program, gl.TRIANGLES);
        //linhas pretas
        gl.uniform4fv(uColorLocation, [0.0, 0.0, 0.0, 1.0]);
        //para nao ocultar as linhas
        gl.depthMask(false);
        primitive.draw(gl, program, gl.LINES);
        gl.depthMask(true);
    }

    function drawGround() {
        const tileSize = 0.5;
        const numTiles = 20;

        const dark = [0.2, 0.2, 0.2, 1.0];
        const light = [0.8, 0.8, 0.8, 1.0];

        pushMatrix();
        for (let i = -numTiles / 2; i < numTiles / 2; i++) {
            for (let j = -numTiles / 2; j < numTiles / 2; j++) {
                pushMatrix();
                let color = light;
                if ((i + j) % 2 === 0) {
                    color = dark
                }
                //-0.01 para descer
                multTranslation([i * tileSize + tileSize / 2, -0.01, j * tileSize + tileSize / 2]);
                multScale([tileSize, 0.01, tileSize]);
                uploadModelView();
                if (drawingMode === 2) {
                    drawPrimitiveInBothModes(primitives["CUBE"], color);
                } else {
                    gl.uniform4fv(uColorLocation, color);
                    primitives["CUBE"].draw(gl, program, getMode(drawingMode));
                }
                popMatrix();
            }
        }
        popMatrix();
    }

    function drawProjectiles() {
        for (const p of projectiles) {
            if (p.active) {
                pushMatrix();
                multTranslation(p.position);
                multScale([0.07, 0.07, 0.07]);
                gl.uniform4fv(uColorLocation, p.color);
                uploadModelView();
                primitives[p.type].draw(gl, program, gl.TRIANGLES);
                popMatrix();
            }
        }
    }



    function updateProjectiles(dt) {
        for (const p of projectiles) {
            if (p.active) {
                //p_i = p_i-1 + v_i * dt
                p.position[0] += p.velocity[0] * dt;
                p.position[1] += p.velocity[1] * dt;
                p.position[2] += p.velocity[2] * dt;

                //v_i = v_i-1 + g * dt
                p.velocity[0] += G[0] * dt;
                p.velocity[1] += G[1] * dt;
                p.velocity[2] += G[2] * dt;

                //colisao com chao -> y=0
                if (p.position[1] <= 0) {
                    p.active = false;
                }
            }
        }
        //remove projeteis inativos porque tocaram no chao ou passaram limite de tempo
        projectiles = projectiles.filter(p => p.active || p.time < 100);
    }

    //MINIGAMES
    function showMiniGameLims() {
        if (isGameActive1 || isGameActive2) {
            //desenha os limites do jogo
            pushMatrix();
            gl.uniform4fv(uColorLocation, [0.8, 0.0, 0.0, 1.0]);
            multTranslation([0.0, 0.5, 5.25]);
            multRotationZ(90)
            multScale([1.5, 10.0, 0.5]);
            uploadModelView();
            primitives["CUBE"].draw(gl, program, gl.TRIANGLES);
            popMatrix();
            pushMatrix();
            gl.uniform4fv(uColorLocation, [0.8, 0.0, 0.0, 1.0]);
            multTranslation([0.0, 0.5, -5.25]);
            multRotationZ(90)
            multScale([1.5, 10.0, 0.5]);
            uploadModelView();
            primitives["CUBE"].draw(gl, program, gl.TRIANGLES);
            popMatrix();

        }
    }

    //Minigame1
    function startMiniGame1() {
        //ajusta a view
        currentViewID = 1;
        zoom = 3;
        //inicia tanque
        tankPos_Z = 0.0;
        isGameActive1 = true;
        cowsToHit = Math.ceil(Math.random() * 3) + 3;
        gameTimer1 = cowsToHit * 2 + Math.random() * 3;
        cowsHitted = 0;
        spawnCow1();

        game1.style.display = "block";
        cows1.innerText = cowsToHit;
        timer1.innerText = gameTimer1.toFixed(1);
    }
    function endMiniGame1() {
        isGameActive1 = false;
        currentCowActive = false;
        cowsToHit = 0;
        cowsHitted = 0;
        game1.style.display = "none";
    }
    function spawnCow1() {
        //aleatoriedade de onde as vacas aparecem
        //distancia do tanque
        let distance = Math.random() * 4 + 2;
        let direction;
        //atras ou a frente do tanque
        if (Math.random() > 0.5) {
            direction = -1;
        } else {
            direction = 1;
        }
        cowZ = tankPos_Z + (distance * direction);
        cowZ = Math.max(MIN_AREA + 0.5, Math.min(MAX_AREA - 0.5, cowZ));
        currentCowActive = true;
    }

    function drawCow1() {
        if (!isGameActive1 || !currentCowActive) {
            return;
        }
        pushMatrix();
        multTranslation([0, 0.5, cowZ]);
        gl.uniform4fv(uColorLocation, [0.0, 0.0, 0.0, 1.0]);
        uploadModelView();
        primitives["COW"].draw(gl, program, gl.TRIANGLES);
        popMatrix();
    }

    function endGameConds1() {
        if (!isGameActive1 || !currentCowActive) {
            return;
        }

        const distance = Math.abs(tankPos_Z - cowZ);
        const limit = TANK_SIZE + COW_SIZE;

        if (gameTimer1 <= 0) {
            endMiniGame1();
            return;
        }

        //tanque saiu dos limites
        if (tankPos_Z < -4 || tankPos_Z > 4) {
            endMiniGame1();
        }

        //houve colisao
        if (distance < limit) {
            cowsHitted++;
            cows1.innerText = cowsToHit - cowsHitted;
            currentCowActive = false;

            if (cowsHitted >= cowsToHit) {
                endMiniGame1();
            } else {
                spawnCow1();
            }
        }
    }

    //MINIGAME2
    function startMiniGame2() {
        //ajusta a view
        currentViewID = 3;
        zoom = 6;
        //reinicia
        tankPos_Z = 0.0;
        endMiniGame1();
        isGameActive2 = true;
        survivalTime = 0;
        spawnTimer = SPAWN_INTERVAL;
        enemies = [];

        game2.style.display = "block";
        record2.innerText = currentRecord.toFixed(2);
        timer2.innerText = survivalTime.toFixed(2);
    }

    function endMiniGame2() {
        if (!isGameActive2) return;
        isGameActive2 = false;

        if (survivalTime > currentRecord) {
            currentRecord = survivalTime;
            record2.innerText = currentRecord.toFixed(2)
        }
        game2.style.display = "none";

    }

    function updateMiniGame2(time) {
        if (!isGameActive2) return;

        survivalTime += time;
        spawnTimer -= time * 3;

        if (spawnTimer <= 0) {
            spawnNextEnemy2();
            spawnTimer = SPAWN_INTERVAL;
        }

        for (const enemy of enemies) {
            if (enemy.active) {
                //calculo posicao e movimento 
                enemy.x += enemy.velocityX * time * 3.5;
                const outOfLimitsX = MAX_AREA + 5.0;
                if (enemy.x > outOfLimitsX || enemy.x < -outOfLimitsX) {
                    enemy.active = false;
                }
            }
        }
        enemies = enemies.filter(e => e.active);
    }

    function spawnNextEnemy2() {
        let spawnX;
        let spawnZ;
        let velocityX;
        //constantes aleatorias para randomizar o aparecimento
        const d = Math.random();
        const e = Math.random()
        //imaginando a vista de topo
        if (d > 0.5) {
            //aparecem de cima
            spawnX = MAX_AREA;
            velocityX = -ENEMY_SPEED;
        } else {
            //aparecem de baixo
            spawnX = MIN_AREA;
            velocityX = ENEMY_SPEED;
        }
        if (d < 0.5) {
            //aparecem à direita da origem
            spawnZ = 0 - d * (MAX_AREA - MIN_AREA - 1.0) - MIN_AREA;
        } else {
            //aparecem à esquerda da origem
            spawnZ = 0 + e * (MAX_AREA - MIN_AREA - 1.0) + MIN_AREA;
        }

        enemies.push({
            x: spawnX,
            z: spawnZ,
            active: true,
            velocityX: velocityX
        });
    }

    function rainbowColors() {
        const timeStamp = performance.now();
        const timeSec = timeStamp / 1000;
        const d = Math.random();
        //usa seno e tempo para gerar cor aleatoria
        const r = (Math.sin(1 / d * timeSec) + 1.5) / 2;
        const g = (Math.sin(1 / d * timeSec + 2) + 1.5) / 2;
        const b = (Math.sin(1 / d * timeSec + 4) + 1.5) / 2;
        const a = 1.0;

        return [r, g, b, a];
    }

    function drawEnemies() {
        if (!isGameActive2) return;

        if (!sensibleMode) {
            for (const enemy of enemies) {
                if (enemy.active) {
                    const currentColor = rainbowColors();
                    gl.uniform4fv(uColorLocation, currentColor);
                    pushMatrix();
                    multTranslation([enemy.x, 0.5, enemy.z]);
                    //aleatoridade para vacas freneticas
                    const d = Math.random();
                    let f;
                    if (d < 0.4) {
                        f = 1.0;
                    } else {
                        f = -1.0;
                    }
                    //rotacao para vacas freneticas
                    multRotationY(f * d / 13 * 180);

                    if (enemy.velocityX < 0) multRotationY(180);
                    uploadModelView();
                    primitives["COW"].draw(gl, program, gl.TRIANGLES);
                    popMatrix();
                }
            }
        } else {
            for (const enemy of enemies) {
                if (enemy.active) {
                    gl.uniform4fv(uColorLocation, [1.0, 0.3, 0.6, 1.0]);
                    pushMatrix();
                    multTranslation([enemy.x, 0.5, enemy.z]);
                    if (enemy.velocityX < 0) multRotationY(180);
                    uploadModelView();
                    primitives["COW"].draw(gl, program, gl.TRIANGLES);
                    popMatrix();
                }
            }

        }
    }

    function endGameConds2() {
        if (!isGameActive2) return;

        const collisionLimit = TANK_SIZE + COW_SIZE;

        //tanque saiu dos limites
        if (tankPos_Z < -4 || tankPos_Z > 4) {
            endMiniGame2();
        }

        //colisao
        for (const enemy of enemies) {
            if (enemy.active) {
                const distanceX = Math.abs(0 - enemy.x);
                const distanceZ = Math.abs(tankPos_Z - enemy.z);

                if (distanceX < collisionLimit && distanceZ < collisionLimit) {
                    endMiniGame2();
                    break;
                }
            }
        }
    }

    function traverse(node, viewMatrix) {
        pushMatrix();

        const t = node.transforms.translation;
        const r = node.transforms.rotation;
        const s = node.transforms.scale;

        let dynamicRotation = [r[0], r[1], r[2]];
        let dynamicTranslation = [t[0], t[1], t[2]];

        if (node.name === "tank") {
            //movimento canhao
            dynamicTranslation[2] += tankPos_Z;
        }
        if (node.name.startsWith("wheel_") || node.name.startsWith("axle_") || node.name.startsWith("cap_")) {
            //rodar rodas, tampas e eixos
            dynamicRotation[1] -= rg;
        }
        if (node.name === "cannon") {
            //mexer canhao
            dynamicRotation[0] -= rc;
        }
        if (node.name === "cabin") {
            //rodar cabine
            dynamicRotation[1] -= rb;
        }

        multTranslation(dynamicTranslation);
        multRotationZ(dynamicRotation[2]);
        multRotationY(dynamicRotation[1]);
        multRotationX(dynamicRotation[0]);
        multScale(s);

        //logica de disparo
        if (node.name === "cannon" && shootRequested) {
            const M_model = mult(inverse(viewMatrix), modelView());
            //em coordenadas do mundo, posicao e direcao
            const p_world = mult(M_model, TIP);
            const d_world = mult(M_model, TIP_DIR);
            //velocidade
            const v_initial = [
                d_world[0] * SHOOT_VELOCITY,
                d_world[1] * SHOOT_VELOCITY,
                d_world[2] * SHOOT_VELOCITY
            ];
            //coelho ou tomate
            let projPrimitive;
            let projColor;
            if (projectileType === 'tomato') {
                projPrimitive = "SPHERE";
                projColor = [1.0, 0.0, 0.0, 1.0];
            } else {
                projPrimitive = "BUNNY";
                projColor = [0.9, 0.9, 0.9, 1.0];
            }
            //guarda os projeteis para serem desenhados
            projectiles.push({
                position: [p_world[0], p_world[1], p_world[2]],
                velocity: v_initial,
                active: true,
                time: 0,
                type: projPrimitive,
                color: projColor
            });

            shootRequested = false;
        }

        //desenha folha
        if (node.type === "leaf") {
            let color = node.color;
            uploadModelView();
            if (drawingMode === 2) {
                drawPrimitiveInBothModes(primitives[node.primitive], color);
            } else {
                gl.uniform4fv(uColorLocation, color);
                primitives[node.primitive].draw(gl, program, getMode(drawingMode));
            }
        }
        //passo recursivo
        else if (node.type === "internal" && node.children) {
            for (const child of node.children) {
                traverse(child, viewMatrix);
            }
        }
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
    function drawScene(viewMatrix) {
        //criar a cena
        loadMatrix(viewMatrix);
        drawGround();
        traverse(sceneGraph, viewMatrix);
        drawProjectiles();
        if (isGameActive1) drawCow1();
        if (isGameActive2) drawEnemies();
        showMiniGameLims();
    }

    function getProjectionMatrix(currentAspect) {
        //fazer a projecao
        if (isPerspective) {
            const fovy = Math.max(5, Math.min(120, 60 * zoom));
            return perspective(fovy, currentAspect, 0.01, 100);
        } else {
            return ortho(-currentAspect * zoom, currentAspect * zoom, -zoom, zoom, -100, 200);
        }
    }

    function calculateObliqueMatrix() {
        const alphaRad = obliqueAlpha * Math.PI / 180;
        const c = Math.cos(alphaRad);
        const s = Math.sin(alphaRad);
        //compensar para tanque ficar centrado
        const z_center = -2.0;

        return mat4(
            // x' = x - z*l*c + (z_center*l*c)
            vec4(1, 0, -obliqueL * c, obliqueL * c * z_center),
            // y' = y - z*l*s + (z_center*l*s)
            vec4(0, 1, -obliqueL * s, obliqueL * s * z_center),
            vec4(0, 0, 1, 0),
            vec4(0, 0, 0, 1)
        );
    }

    function render() {
        window.requestAnimationFrame(render);
        console.log(`View: ${currentViewID} | isOblique: ${isView4Oblique} | Axon(Az: ${axonometricAzimuth}, El: ${axonometricElevation}) | Oblique(L: ${obliqueL}, A: ${obliqueAlpha})`);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);

        const w = canvas.width;
        const h = canvas.height;
        //unidade de tempo
        const d = 1 / 60;
        updateProjectiles(d);

        if (isGameActive1) {
            gameTimer1 -= (d);
            let displayTime = Math.max(0, gameTimer1);
            timer1.innerText = displayTime.toFixed(1);
            endGameConds1();
        }
        if (isGameActive2) {
            updateMiniGame2(d);

            let displayTime2 = Math.max(0, survivalTime);
            timer2.innerText = displayTime2.toFixed(2);

            endGameConds2();
        }

        //converter para rad
        const azRad = axonometricAzimuth * Math.PI / 180.0;
        const elRad = axonometricElevation * Math.PI / 180.0;
        //calcular eye
        const eyeX = view4At[0] + axonometricDist * Math.cos(elRad) * Math.sin(azRad);
        const eyeY = view4At[1] + axonometricDist * Math.sin(elRad);
        const eyeZ = view4At[2] + axonometricDist * Math.cos(elRad) * Math.cos(azRad);
        //vista axonometrica
        mViewAxonometric = lookAt([eyeX, eyeY, eyeZ], view4At, view4Up);
        //multivista
        if (isMultiView) {
            const w2 = w / 2;
            const h2 = h / 2;
            const viewportAspect = w2 / h2;

            //cima (canto inferior esquerdo)
            gl.viewport(0, 0, w2, h2);
            mProjection = getProjectionMatrix(viewportAspect);
            uploadProjection();
            drawScene(mViewTop);

            //frontal (canto superior esquerdo)
            gl.viewport(0, h2, w2, h2);
            mProjection = getProjectionMatrix(viewportAspect);
            uploadProjection();
            drawScene(mViewFront);

            //esquerda (canto superior direito)
            gl.viewport(w2, h2, w2, h2);
            mProjection = getProjectionMatrix(viewportAspect);
            uploadProjection();
            drawScene(mViewLeft);

            //axonometrica/obliqua (canto inferior direito)
            gl.viewport(w2, 0, w2, h2);
            let baseProjection = getProjectionMatrix(viewportAspect);
            if (isView4Oblique) {
                const mObliqueShear = calculateObliqueMatrix();
                mProjection = mult(baseProjection, mObliqueShear);
                uploadProjection();
                drawScene(mViewFront);
            } else {
                mProjection = baseProjection;
                uploadProjection();
                drawScene(mViewAxonometric);
            }
        } else {
            //vista unica (ecra inteiro)
            gl.viewport(0, 0, w, h);
            let currentView;
            let currentProjection = getProjectionMatrix(aspect);

            switch (currentViewID) {
                case 1:
                    currentView = mViewFront;
                    break;
                case 2:
                    currentView = mViewLeft;
                    break;
                case 3:
                    currentView = mViewTop;
                    break;
                case 4:
                    if (isView4Oblique) {
                        const mObliqueShear = calculateObliqueMatrix();
                        currentProjection = mult(currentProjection, mObliqueShear);
                        currentView = mViewFront;
                    } else {
                        currentView = mViewAxonometric;
                    }
                    break;
            }
            mProjection = currentProjection;
            uploadProjection();
            drawScene(currentView);
        }
    }
}
const shader_urls = ["shader.vert", "shader.frag"];
const scene_url = "scene.json";

loadShadersFromURLS(shader_urls).then(shaders => {
    loadJSONFile(scene_url).then(sceneData => {
        setup(shaders, sceneData);
    });
});