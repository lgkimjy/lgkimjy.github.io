---
layout: page
title: Pointfoot Locomotion
description: Developing gait method for the wheel-legged humanoid robot.
img: assets/img/pointfoot_locomotion/walk_kin.gif
importance: 1
category: robotics
# related_publications: einstein1956investigations, einstein1950meaning
---

### Research Purpose
* Development of a wheel-legged humanoid robot for proximity support services in a living space.
* LQR, MPC-based Planner
* Pointfoot Gait Controller

---

### Wheel-legged humanoid robot

<div class="row justify-content-center">
    <div style="width: 335px; margin-right: 10px; margin-top: 15px;">
            {% include figure.html path="assets/img/pointfoot_locomotion/mahru.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                MAHRU_WL
        </div>
    </div>
    <div style="width: 289px; margin-top: 15px;">
            {% include figure.html path="assets/img/pointfoot_locomotion/mahru_sim.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            MAHRU_WL in MuJoCo
        </div>
    </div>
</div>

---

### Optimization-based Whole-body Controller

---

### Optimization-based Foot Step Planning w/ template model
<div class="row justify-content-center">
    <div style="width: 500px; margin-top: 15px;">
            {% include figure.html path="assets/img/pointfoot_locomotion/pattern.gif" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">MAHRU_WL</div>
    </div>
</div>
<div class="row justify-content-center">
    <iframe width="510" height="480" src="https://www.youtube.com/embed/IO0bd1jgGNI?si=1dpnnb4E0Tm0JKt9" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>
<div class="caption">MAHRU_WL</div>

$$
\small
\begin{aligned}
& \min _{u_{T, x}, u_{T, y}, \tau, b_x, b_y} \alpha_1\left\|u_{T, x}-L_{n o m}\right\|+\alpha_2\left\|u_{T, y}-W_{n o m}\right\| \\ & \quad + \alpha_3\left\|\tau-\tau_{n o m}\right\|+\alpha_4\left\|b_x-b_{x, \text { nom }}\right\|+\alpha_5\left\|b_y-b_{y, n o m}\right\| \\ \\
& \text { s.t. } \left[\begin{array}{ccccc}
1 & 0 & 0 & 0 & 0 \\
-1 & 0 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 & 0 \\
0 & -1 & 0 & 0 & 0 \\
0 & 0 & 1 & 0 & 0 \\
0 & 0 & -1 & 0 & 0
\end{array}\right]\left[\begin{array}{c}
u_{T, x} \\
u_{T, y} \\
\tau \\
b_x \\
b_y
\end{array}\right] \leq\left[\begin{array}{c}
L_{\max } \\
-L_{\min } \\
W_{\max } \\
-W_{\min } \\
e^{\omega_0 T_{\max }} \\
-e^{\omega_0 T_{\min }}
\end{array}\right] \\
& {\left[\begin{array}{ccccc}
1 & 0 & -\left(\xi_{\text {mea}}-u\right) e^{-\omega_0 t} & 1 & 0 \\
0 & 1 & -\left(\xi_{\text {mea}}-u\right) e^{-\omega_0 t} & 0 & 1
\end{array}\right]\left[\begin{array}{c}
u_{T, x} \\
u_{T, y} \\
\tau \\
b_x \\
b_y
\end{array}\right]=\left[\begin{array}{c}
u_{x} \\
u_{y}
\end{array}\right]} \\
&
\end{aligned}
$$

