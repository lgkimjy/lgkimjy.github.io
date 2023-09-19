---
layout: post
title:  "[robotics] Analytical vs Geometric Jacobian?"
date: 2022-07-10
description: what is jacobian? and what is the difference between analytical and geometric jacobian?
tags: robotics jacobian
# categories: sample-posts
# thumbnail: assets/img/9.jpg
---

## [Jacobian](#jacobian)
* Jacobian Matrix is a matrix which maps relationship between <span style="background-color: #674900">joint space</span> and <span style="background-color: #674900">velocities of manipulator end-effector(EE)</span>.
* Both [Geometric Jacobian](#geometricbasic-jacobian) and [Analytical Jacobian](#analytical-jacobian) relates joint velocities $$\dot q$$ with linear and angular velocities $$\dot x$$:
  
$$
\dot x = J \dot q
$$

---
#### [Geometric(basic) Jacobian](#geometricbasic-jacobian)
if use the geometric jacobian, will get the angular velocities around $$x$$, $$y$$ and $$z$$:

$$
\dot x = 
\begin{Bmatrix}
v \\
\omega
\end{Bmatrix} =
\begin{Bmatrix}
\frac{dx}{dt} \\
\frac{dy}{dt} \\
\frac{dz}{dt} \\
\omega_x \\
\omega_y \\
\omega_z
\end{Bmatrix}
$$

where, $$v$$ is linear velocity, and $$\omega$$ is angular velocity

#### [Analytical Jacobian](#analytical-jacobian)
On the other hand, both geometric and analytical jacobians will give the same result for linear velocities. But, the result is different for angular velocities. If using the analytical jacobian, time derivative of the angles that you chose to represent the orientation of the end effector:

$$
\dot x = \frac{d}{dt}
\begin{Bmatrix}
x \\ y \\ z \\ \phi \\ \theta \\ \psi
\end{Bmatrix} = 
\begin{Bmatrix}
\frac{dx}{dt} \\
\frac{dy}{dt} \\
\frac{dz}{dt} \\
\frac{d\phi}{dt} \\
\frac{d\theta}{dt} \\
\frac{d\psi}{dt}
\end{Bmatrix}
,
\qquad
J_\mathcal{A} = 
\left[\begin{array}{lllllll}
\frac{\partial x}{\partial q_1} & \frac{\partial x}{\partial q_2} & \cdots & \frac{\partial x}{\partial q_n} \\
\frac{\partial y}{\partial q_1} & \frac{\partial y}{\partial q_2} & \cdots & \frac{\partial y}{\partial q_n} \\
\frac{\partial z}{\partial q_1} & \frac{\partial z}{\partial q_2} & \cdots & \frac{\partial z}{\partial q_n} \\
\frac{\partial \phi}{\partial q_1} & \frac{\partial \phi}{\partial q_2} & \cdots & \frac{\partial \phi}{\partial q_n} \\
\frac{\partial \theta}{\partial q_1} & \frac{\partial \theta}{\partial q_2} & \cdots & \frac{\partial \theta}{\partial q_n} \\
\frac{\partial \psi}{\partial q_1} & \frac{\partial \psi}{\partial q_2} & \cdots & \frac{\partial \psi}{\partial q_n}
\end{array}\right]
$$

#### [Mapping between Geometic and Analytical](#mapping-between-geometic-and-analytical)

$$
J_\mathcal{A}(q) = E(\mathbf{x}) J(q)
$$

$$
E = 
\begin{bmatrix}
I & 0 \\
0 & E_r
\end{bmatrix}
$$

---
#### [Ref](#ref)
1. [rosroboticslearning.com](https://www.rosroboticslearning.com/jacobian)
2. [etedal peronsal blog](https://www.etedal.net/2014/12/analytical-jacobian-vs-geometrical.html)
3. [Robot Dynamics lecture3: jacobian](https://www.youtube.com/watch?v=Kzm1aojcQXA&list=PLE-BQwvVGf8GMY11YEONylkQNu0UWj0VE&index=10)
4. [Lecture Note7: Velocity Kinematics and Jacobian](http://www2.ece.ohio-state.edu/~zhang/RoboticsClass/docs/LN7_VelocityKinematics_a.pdf)