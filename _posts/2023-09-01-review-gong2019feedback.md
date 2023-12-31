---
layout: post
title: "[paper review] Feedback Control of a Cassie Bipedal Robot"
date: 2022-12-12
description: This paper focuses on feedback control for standing and walking using the methods of virtual constraints and gait libraries.
tags: paper-review
# categories: sample-posts
thumbnail: assets/img/review/cassie/cassie.png
---

Bipedal Robot은 대표적으로 [Atlas](https://www.bostondynamics.com/atlas), [ASIMO](https://en.wikipedia.org/wiki/ASIMO), [Valkyrie](https://sites.utexas.edu/hcrl/files/2016/01/jfr-nasa-hcrl-final.pdf), [LIGHT](https://www.youtube.com/shorts/gUEyQwPnTNg), [NAO](https://www.aldebaran.com/en/nao), [Optimus](https://en.wikipedia.org/wiki/Optimus_(robot)) 등이 있습니다. 다양한 이족보행이 있듯, 다양한 Gait Method가 존재하는데 이는 로봇의 기구학적 구조, 모터(유압, 전기식), 사용되는 센서(IMU, FT센서) , 발바닥의 모양 등에 따라서 보행법이 결정되거나 합니다. 

오늘은 개인적으로 작은 면적의 발바닥을 가진 로봇 중, 가장 대표적인 로봇 Agility Robotics의 이족보행 로봇인 Cassie의 [Feedback Control of a Cassie Bipedal Robot: Walking, Standing, and Riding a Segway](https://arxiv.org/pdf/1809.07279.pdf) ([논문](https://ieeexplore.ieee.org/document/8814833))에 관한 리뷰입니다. 

---

## Abstract

Agility Robotics에서 설계한 Cassie 2족 보행 로봇은 연구원들에게 Locomotion, Perception 및 Navigation을 위한 알고리즘을 공유하고 비교하기 위한 공통 플랫폼을 제공하고 있습니다. 본 논문은 virtual Constraints 및 Gaits Library의 방법을 사용하여 Standing 및 Walking을 위한 피드백 제어에 중점을 두었습니다. 설계된 컨트롤러는, 로봇이 미시간 대학에 도착한지 6주만에 구현되었으며, 인도, 잔디, 눈, 모래를 걷는 것 뿐만 아니라 제자리에 설 수 있도록 구현했습니다.

---

## Introduction

본 논문은 Cassie의 open-source controller에 대한 소개와 document작성을 위해 쓰인 논문입니다. Agility robotics에서 만든 로봇으로 Michigan, Caltech, Harvard등에서 연구목적으로 사용되고 있으며, 각 학교마다 다른 제어 이론으로 로봇을 갖추었다고 합니다. 그리고, 초기에 작성된 .p MATLAB코드로 Real-Time Simmulink로 돌아간다고 합니다. 초기 코드는 상당히 obfuscated(난독화)되어 있지만, 기본적인 standing, walking(전진, 후진, sidewalk)과 같은 기능을 할 수 있었다고 합니다. 

대부분 휴머노이드의 Walking Gaits는 Zero-Moment Point(ZMP)를 조절(regulate)해서 stablize합니다. 하지만, 이를 위한 전제 조건은 로봇의 발바닥이 어느 정도 사이즈를 가져, support polygon을 만들 수 있어야 하지만, Cassie는 line형태의 발을 가져서 해당 method는 applicable하지 않습니다. 

Gait 설계와 stabliization 문제를 해결하기 위해서는 로봇의 dynamics를 inverted pendulum로 모델링하여 사용되고 있다. Pendulum 모델링의 중요한 특징은 바로 CoM의 Cartesian velocity가 발 위치에 따라 stabilized(안정화)가 될수 있다는 것이다. 다시말해, 하나의 Leg가 지면에 접촉 할 때, Swing Leg의 각도를 제어함으로써 로봇의 속도를 원하는 값으로 조절 할 수 있는 것이다.  

---

## Cassie Robot

그림1의 로봇은 Agility Robotics에서 개발한 Cassie Blue라는 로봇이다. 이는 완전 전기식 모터로 구성되어 있으며, 한번의 충전으로 최대 4시간의 보행이 가능하다. 로봇의 형태와 이름은 [Cassowary](https://en.wikipedia.org/wiki/Cassowary)에서 영감을 받아 만들어졌다. Standing자세에서 최대 1m의 높이를 가지며, 31kg의 mass, 20 DoF를 가지는 로봇이다. Leg당 7개의 joints(2개의 passive joints, 5개의 active joints)를 가진다. 5개의 electric motor로 구동(actuated)되는데, 그 중 3개의 모터는 로봇 torso의 roll, pitch, yaw를 만들기 위해, 나머지 한개씩의 모터는 로봇 knee의 pitch와 toe(feet)의 pitch를 regulate하기 위해 사용된다. 

### A. Coordinate and Actuation Description

Cassie의 [URDF](https://github.com/UMich-BipedLab/Cassie_Model), 그리고 kinematic model과 configuration variables는 그림2에 label되어 있다. $$(q_x, q_y, q_z)$$는 로봇 torso의 cartesian position, $$q_{yaw}, q_{pitch}, q_{roll}$$은 intrinsic Euler Angles로 z-y-x순으로 구성되어 있다. $$q_1, q_2, q_3$$는 hip roll, yaw, pitch순, $$q_4$$는 knee pitch, $$q_5$$은 shin pitch angle, $$q_6$$는 tarsus pitch angle, 마지막 $$q_7$$은 toe pitch angle을 표현한다. 

<div class="row mt-3">
    <div class="row justify-content-center">
        <div class="col-sm-6 mt-3 mt-md-3">
            {% include figure.html path="assets/img/review/cassie/cassie.png" class="img-fluid rounded z-depth-1" zoomable=true%}
        </div>
        <div class="col-sm-6 mt-3 mt-md-0">
            {% include figure.html path="assets/img/review/cassie/config.png" class="img-fluid rounded z-depth-1" zoomable=true%}
        </div>
        <div class="caption">Fig.1(왼) Cassie Blue, Fig.2(오) Cassie Blue의 Kinematic Configuration</div>
    </div>
</div>

$$
\begin{aligned}
q:= & {\left[q_x, q_y, q_z, q_{\mathrm{yaw}}, q_{\mathrm{pitch}}, q_{\mathrm{roll}},\right.} \\
& q_{1 L}, q_{2 L}, q_{3 L}, q_{4 L}, q_{5 L}, q_{6 L}, q_{7 L}, \\
& \left.q_{1 R}, q_{2 R}, q_{3 R}, q_{4 R}, q_{5 R}, q_{6 R}, q_{7 R}\right]^{\top}
\end{aligned}
$$

<center><font size="2"><figcaption>Eq.1 All coordinates lumped into a Vector</figcaption></font></center>

$$
q_{\text {body }}:=\left[q_{1 L}, \ldots, q_{7 L}, q_{1 R}, \ldots, q_{7 R}\right]^{T}
$$

<center><font size="2"><figcaption>Eq.2 Body Coordinates</figcaption></font><br /></center>
 

 
로봇의 euler parameters는 [VectorNav-100](https://www.google.com/search?client=safari&rls=en&q=VectorNav100&ie=UTF-8&oe=UTF-8), IMU센서의 EKF output으로 estimated된다.  구동되는 actuator는 $$q_1, q_2, q_3, q_4, q_7$$입니다. $$q_5, q_6$$는 passive하며, stiff한 springs처럼 작용해서, uncompressed 상태에는 다음과 같은 각을 유지합니다.

$$
q_5=0, \text { and } q_6=-q_4+13^{\circ}
$$

<center><font size="2"><figcaption>Eq.3 shin, tarsus pitch angle</figcaption></font><br /></center>

### B. Floating-base Model

Floating-base dynamics는 라그랑지안(Lagrange)로 표현 할 수 있다.

$$
D(q) \ddot{q}+H(q, \dot{q})=B u+J_{s p}(q)^{\top} \tau_{\mathrm{sp}}+J(q)^{\top} \lambda
$$

<center><font size="2"><figcaption>Eq.4 Floating-base model Lagrange Eq.</figcaption></font><br /></center>

-   $$q$$는 Eq.1에서 표현된 generalized coordinates,
-   $$u$$는 vector of motor torques,
-   $$\tau_{sp}$$는 spring torques,
-   $$\lambda$$는 contact wrench,
-   $$D(q)$$는 mass-inertia matrix,
-   $$H(q,\dot{q})$$는 velocity와 gravitational terms가 포함되어 있는 matrix,
-   $$B$$는 motor torque distribution matrix,
-   마지막 $$J_{sP}$$는 spring의 자코비안 matrix로 Eq.5로 표현된다. 

$$
J_{s p}(q):=\frac{\partial}{\partial q}\left[\begin{array}{l}
q_{5 \mathrm{~L}} \\
q_{4 \mathrm{~L}}+q_{5 \mathrm{~L}}+q_{6 \mathrm{~L}} \\
q_{5 \mathrm{R}} \\
q_{4 \mathrm{R}}+q_{5 \mathrm{R}}+q_{6 \mathrm{R}}
\end{array}\right]
$$

<center><font size="2"><figcaption>Eq.5 Jacobian for the springs</figcaption></font><br /></center>

Ground Contact Jacobian은 다음 섹션에서 설명된다. 

### C. hybrid model for walking

보행(Walking)은 Single Support, Double Support가 번갈아 가는 단계에 해당하는 Hybrid System으로 모델링된다. 여기서 Double Support는 순간적인 단계로 가정할 수 있다. 본 논문은 두가지 도메인을 사용하게 되는데: 오른쪽 다리로 지지될 때(right leg in stance)와, 왼쪽 다리로 지지될 때(left leg in stance), 그리고 Non-Stance foot은 swing foot이라고도 한다. 주기적인 보행 computation은 오른쪽 다리와 왼쪽 다리 각각 한 step 마다 계산된다.

다음은 오른쪽 다리가 지지하고, 왼쪽 다리가 swing하는 것을 가정하여 설명하겠습니다. (R라벨과 L라벨은 왼쪽 다리가 지지할때 Swap된다고 생각하시면 됩니다.)

<div class="row justify-content-center">
    <div class="col-sm-4 mt-0 mt-md-0">
        {% include figure.html path="assets/img/review/cassie/feet_coord.png" class="img-fluid rounded z-depth-1" zoomable=true%}
    </div>
</div>
<div class="caption">Fig.3 Coordinates on the feet</div>

1 )  Single Support: Ground Contact은 foot(발)의 position과 orientation에 holonomic constraint를 준다고 가정한다. $$C_R(q)$$,

$$
c_{\mathrm{R}}(q)^{\top}:=\left[p_{\mathrm{R}}^x, p_{\mathrm{R}}^y, p_{\mathrm{R}}^z, \psi_R^{\mathrm{yaw}}, \psi_R^{\mathrm{pitch}}\right]^{\top}
$$

<center><font size="2"><figcaption>eq.6</figcaption></font><br /></center>


With the right foot in stance, the contact Jacobian is $$J_R(q):= \frac{}{}$$; the contact constraint is imposed by setting its accleration to zero.

$$
J_{\mathrm{R}}(q) \ddot{q}+\dot{J}_{\mathrm{R}}(q, \dot{q}) \dot{q}=0
$$

<center><font size="2"><figcaption>eq.7</figcaption></font><br /></center>

2 ) Double Support: The transition from single support to double support is captured by the height of the swing foot from the ground decreasing to zero. Specifically, with the right foot in stance, the transition set is

$$
\mathcal{S}_{\mathrm{R} \rightarrow \mathrm{L}}=\left\{(q, \dot{q}) \in \mathcal{T} \mathcal{Q} \mid p_L^z(q)=0, \dot{p}_L^z(q, \dot{q})<0\right\}
$$

<center><font size="2"><figcaption>eq.8 Transition Set</figcaption></font><br /></center>


where $$p_L^z$$ is the vertical component of the position of the swing foot; see Fig.3a. 순간적인 impact은 discrete map으로 모델될 수 있다. 

$$
\left[\begin{array}{cc}
D(q) & -J_{\mathrm{L}}^T(q) \\
J_{\mathrm{L}}(q) & 0
\end{array}\right]\left[\begin{array}{c}
\dot{q}^{+} \\
\delta F_{\mathrm{L}}
\end{array}\right]=\left[\begin{array}{c}
D(q) \dot{q}^{-} \\
0
\end{array}\right]
$$

<center><font size="2"><figcaption>eq.9</figcaption></font><br /></center>

$$
\dot{q}^{+}=: \Delta_{\mathrm{R} \rightarrow \mathrm{L}}\left(\dot{q}^{-}\right)
$$

<center><font size="2"><figcaption>eq.10</figcaption></font><br /></center>


3 ) Hybrid Model: overall model은 다음과 같이 주어진다.

$$
\Sigma:\left\{\begin{array}{rlrl}
D(q) \ddot{q}+H(q, \dot{q}) & =B u+J_{s p}(q)^{\top} \tau_{\mathrm{sp}}+J_{\mathrm{R}}(q)^{\top} \lambda \\
J_{\mathrm{R}}(q) \ddot{q}+\dot{J}_{\mathrm{R}}(q, \dot{q}) \dot{q} & =0 & & \left(q ; \dot{q}^{-}\right) \notin \mathcal{S}_{\mathrm{R} \rightarrow \mathrm{L}} \\
\dot{q}^{+} & =\Delta_{\mathrm{R} \rightarrow \mathrm{L}}\left(\dot{q}^{-}\right) & & \left(q ; \dot{q}^{-}\right) \in \mathcal{S}_{\mathrm{R} \rightarrow \mathrm{L}} \\
& & \\
D(q) \ddot{q}+H(q, \dot{q}) & =B u+J_{s p}(q)^{\top} \tau_{\mathrm{sp}}+J_{\mathrm{L}}(q)^{\top} \lambda \\
J_{\mathrm{L}}(q) \ddot{q}+\dot{J}_{\mathrm{L}}(q, \dot{q}) \dot{q} & =0 & & \left(q ; \dot{q}^{-}\right) \notin \mathcal{S}_{\mathrm{L} \rightarrow \mathrm{R}} \\
\dot{q}^{+} & =\Delta_{\mathrm{L} \rightarrow \mathrm{R}}\left(\dot{q}^{-}\right) & & \left(q ; \dot{q}^{-}\right) \in \mathcal{S}_{\mathrm{L} \rightarrow \mathrm{R}}
\end{array}\right.
$$

<center><font size="2"><figcaption>eq.11 Hybrid Model</figcaption></font><br /></center>


### D. Model for standing
Cassie는 stand(기립) 할 수도 있는데, 이때 모델은 Eq.4와  $$J_T = [J_R^T, J_L^T]$$ 로 만들 수 있다. 만약 두 발이 평평한 지면에 있을 경우, 10DoF가 제거 될 수 있다. 이 경우, 스프링 stiffness가 무한하다고 간주되어, 두 발의 x축이 공통선에 있지 않을 때, 모델은 완전히 actuated된다고 한다.

---

## Walking on various terrains

이번 섹션에서는 초기에 구현된 cassie의 보행 컨트롤러에 대해 설명합니다. Control Design은 sagital plane에 제한된 *virtual constraints (gait library)*, 그리고  sagital과 frontal planes에서의 *leg-angle adjustment*에 기초한다. 

### A. Virtual Constraints

Virtual Constraints는 피드백 제어를 통해 시스템에 점근적으로 부과되는 로봇의 generalized coordinates 사이의 기능적 관계를 표현 할 수 있다. Virtual Constraints의 모델은 다음 식의 output으로 표현됩니다. 

$$
y=h(q, \tau, \alpha)=h_0(q)-h_d(\tau, \alpha)
$$

<center><font size="2"><figcaption>eq.12</figcaption></font><br /></center>


여기서, $$h_0$$는 조절에 사용되는 quantities(양)을 의미 하며, $$h_d$$는 desired evolution, $$\alpha$$는 spline을 parameter화 하는 real coefficient 행렬을 의미합니다. Phasing variable $$\tau$$는 다음 조건 eq.13을 만족합니다. 여기서 $$T$$는 nominal step duration입니다.

$$
\begin{aligned}
\dot{\tau} & =\frac{1}{T}, & \left(q ; \dot{q}^{-}\right) \notin \mathcal{S}_{\mathrm{R} \rightarrow \mathrm{L}} \cup \mathcal{S}_{\mathrm{L} \rightarrow \mathrm{R}} \\
\tau^{+} & =0 & \text { otherwise },
\end{aligned}
$$

<center><font size="2"><figcaption>eq.13</figcaption></font><br /></center>


### B. Choice of What to Control

<div class="row justify-content-center">
    <div class="col-sm-4 mt-0 mt-md-0">
        {% include figure.html path="assets/img/review/cassie/virtual_leg.png" class="img-fluid rounded z-depth-1" zoomable=true%}
    </div>
</div>
<div class="caption">Fig.4 Virtual Leg is the dotted line.</div>

Cassie는 $$h_0$$을 조절하여 제어를 하게 됩니다. 여기서, $$h_0$$는 torso orientation, stance, swing leg length, swing leg orientaiton 및 swing foot pitch 각도등을 의미합니다. 이를 염두에 두고, stance foot pitch 각도를 passive로 하여 다음 9개의 출력을 정의하게 됩니다. 

$$
h_0(q)=\left[\begin{array}{l}
q_{\text {roll }} \\
q_{2 \text { st }} \\
q_{\text {pitch }} \\
q_{\text {LL st }} \\
q_{\mathrm{LR} \mathrm{sw}} \\
q_{2 \mathrm{sw}} \\
q_{\mathrm{LP} \mathrm{sw}} \\
q_{\mathrm{LL} \mathrm{sw}} \\
q_{\mathrm{FP} \mathrm{sw}}
\end{array}\right] \quad\left(\begin{array}{c}
\text { torso roll } \\
\text { stance hip yaw } \\
\text { torso pitch } \\
\text { stance leg length } \\
\text { swing leg roll } \\
\text { swing hip yaw } \\
\text { swing leg pitch } \\
\text { swing leg length } \\
\text { swing foot pitch }
\end{array}\right)
$$

<center><font size="2"><figcaption>eq.14</figcaption></font><br /></center>


eq.14에서 right leg가 stance 상태, left leg가 swing 상태입니다. 

$$
\begin{aligned}
& q_{\mathrm{LL} \mathrm{st}}=\sqrt{0.5292 \cos \left(q_{4 \mathrm{R}}+0.035\right)+0.5301} \\
& q_{\mathrm{LR} \mathrm{sw}}=q_{\text {roll }}+q_{1 \mathrm{~L}} \\
& q_{\mathrm{LP} \mathrm{sw}}=-q_{\text {pitch }}+q_{3 \mathrm{~L}} \\
&-\arccos \left(\frac{0.5\left(\cos \left(q_{4 \mathrm{~L}}+0.035\right)+0.5292\right)}{\sqrt{0.5292 \cos \left(q_{4 \mathrm{~L}}+0.035\right)+0.5301}}\right)+0.1 \\
& q_{\mathrm{LL} \mathrm{sw}}=\sqrt{0.5292 \cos \left(q_{4 \mathrm{~L}}+0.035\right)+0.5301} \\
& q_{\mathrm{FP} \mathrm{sw}}=-q_{\text {pitch }}+q_{7 \mathrm{~L}}+1.1 .
\end{aligned}
$$

<center><font size="2"><figcaption>eq.15</figcaption></font><br /></center>


그림4에 구성된 robot configuration에 맞춰, 다리 length 및 다리 pitch를 이용하여 로봇의 FK를 구합니다. 여기서, Leg pitch는 virtual leg의 angle로 참조되며, torso roll과 yaw는 0가 되는 상황일때를 말합니다. 

$$
\begin{aligned}
q_1= & q_{\mathrm{LR}}-q_{\mathrm{roll}} \\
q_3= & q_{\mathrm{LP}}+q_{\mathrm{pitch}} \\
& +\arccos \left(\frac{0.9448 q_{\mathrm{LL}}^2-0.0284}{q_{\mathrm{LL}}}\right)-0.1 \\
& \arccos \left(1.8896 q_{\mathrm{LL}}^2-1.0017\right)-0.035 \\
q_4= & q_{\mathrm{FP}}+q_{\mathrm{pitch}}-1.1,
\end{aligned}
$$

<center><font size="2"><figcaption>eq.16</figcaption></font><br /></center>


제어 구현(implementation)을 위해서, 앞서 구해진 eq.15의 variable은 eq.16에서 사용된다. 이를 통해, stance 상태와 swing 상태의 차이가 줄어들게 됩니다. 

### C. Set of Gaits for Walking at Various Speeds

<div class="row mt-3">
    <div class="row justify-content-center">
        <div class="col-sm-10 mt-3 mt-md-0">
            {% include figure.html path="assets/img/review/cassie/constarints.png" class="img-fluid rounded z-depth-1" zoomable=true%}
        </div>
        <div class="caption">Cassie Blue walking on various unmodeled terrains.</div>
    </div>
</div>

### D. Approximately Implementing the Virtual Constraints

만약 전반적인 dynamic model과 joint angular velocity estimates가 충분히 정확하다면 입, 출력 linearization을 통해 virtual constraints을 구현할 수 있습니다. 그러나 실제 로봇에서는 power amplifiers, motor dynamics, network delyas, walking surface가 특성화되어 있지 않기 때문에, Virtual Constraints는 분리된(decoupled) PD컨트롤러를 통해 approximately하게 주어지게 됩니다. 이를 위해서 eq.16은 eq.12를 사용하기 위해 다음과 같이 다시 구성됩니다. 

$$
\widetilde{y}=\widetilde{h}_0(q)-\widetilde{h}_d\left(\tau, q_{\mathrm{pitch}}, q_{\mathrm{roll}}, \alpha\right)
$$

<center><font size="2"><figcaption>eq.17</figcaption></font><br /></center>

$$
\begin{aligned}
\widetilde{h}_0(q)^{\top}= & {\left[q_{\text {roll }}, q_{2 \mathrm{R}}, q_{\mathrm{pitch}}, q_{4 \mathrm{R}},\right.} \\
& \left.q_{1 \mathrm{~L}}, q_{2 \mathrm{~L}}, q_{3 \mathrm{~L}}, q_{4 \mathrm{~L}}, q_{7 \mathrm{~L}}\right]^{\top}
\end{aligned}
$$

<center><font size="2"><figcaption>eq.18</figcaption></font><br /></center>

$$
\widetilde{h}_d(\cdot)=\left[\begin{array}{l}
h_d 1(\cdot) \\
h_d 2(\cdot) \\
h_d 3(\cdot) \\
\arccos \left(1.8896\left[h_{d 4}(\cdot)\right]^2-1.0017\right)-0.035 \\
h_d 5(\cdot)-q_{\text {roll }} \\
h_d 6(\cdot) \\
h_d 7(\cdot)+q_{\text {pitch }}+0.1 \\
\quad+\arccos \left(\frac{0.9448\left(h_d 8(\cdot)\right)^2-0.0284}{h_d 8(\cdot)}\right) \\
\arccos \left(1.8896\left[h_{d 8}(\cdot)\right]^2-1.0017\right)-0.035 \\
h_d 9(\cdot)+q_{\text {pitch }}-1.1
\end{array}\right]
$$

<center><font size="2"><figcaption>eq.19</figcaption></font><br /></center>


eq.18과 eq.19의 output을보면, stance Leg의 첫번째 4개의 actuator에 해당하고, Swing Leg의 5개의 actuator에 해당하도록 정렬된다. 여기서, Stance Foot의 Torque가 0으로 설정된다는 것을 기억해야한다. 

$$
u=-K_P \widetilde{y}-K_D \dot{\widetilde{y}}
$$

<center><font size="2"><figcaption>eq.20 Control input u</figcaption></font><br /></center>


이렇게 Virtual Constraints는 PD controller를 사용하여 , 대략적으로 0이 되는 $K_P, K_D$가 9x9인 대각행렬을 만들수 있다. 

### E. Gait Library and Stabilization by Leg Angle Adjustment

Gait Library는 -0.5 ≤ vx ≤ 1.0 m/s에 유효한 7개의 개별 보행(discrete gaits)를 연속적인 보행(continuum of gaits)이 되도록 만들어주는 보간(interpolation)입니다.

<div class="row mt-3">
    <div class="row justify-content-center">
        <div class="col-sm-10 mt-3 mt-md-0">
            {% include figure.html path="assets/img/review/cassie/diagram.png" class="img-fluid rounded z-depth-1" zoomable=true%}
        </div>
        <div class="caption">Fig.5 Control Diagram for Walking.</div>
    </div>
</div>

Gait Library가 적용(implementation)되면 Cartesian 좌표 $$(\dot{x}, \dot{y})$$를 감지(sense)하기에는 Closed-Loop System이 불안정하다. Closed-Loop System을 안정화하기 위해 Leg-Angle Adjustment가 추가되었고, 전반적인 제어 전략은 그림 4와 같다. ( [Gait Library 관련 논문 참조](https://ieeexplore.ieee.org/document/7501826) - 본 논문의 eq.(8)-(10), (13), (17)을 적용 ) 

### F. Parameter Tuning

위 내용은 pass합니다.

### G. Experiments

결과적으로, Grass, Burning Brush, Snow, Sand와 같이 unmodeled된 환경 속에서도 걸을수 있었다..ㅎ..

<div class="row mt-3">
    <div class="row justify-content-center">
        <div class="col-sm-10 mt-3 mt-md-0">
            {% include figure.html path="assets/img/review/cassie/various_terrain.png" class="img-fluid rounded z-depth-1" zoomable=true%}
        </div>
        <div class="caption">Cassie Blue walking on various unmodeled terrains.</div>
    </div>
</div>
---

## Quiet Standing and Riding a segway

위 내용은 pass합니다. 

---

## Conclusion

Cassie Biped는 날지 못하는 큰 새의 형태를 가지고 있습니다. 전체 20DoF의 동적 모델 및 최적화를 사용하여 주요 물리적 제약조건을 충족하면서 제자리, 앞, 뒤로 걷기 위한 7개의 보행 공간을 설계했습니다. 또한, 로봇에서 분리된 PD컨트롤러를 통해 제어 목표를 실징적으로 구현하는 방법을 보여주었습니다 최종적을 완성된 controller는 인도(sidewalks), 잔디(grass), 모래(sand), 왁스칠한 바닥(waxed floors), 눈(snow), 언덕(hill)을 걷을 것을 포함하여 연구실 안팍에서 시연되었습니다.
