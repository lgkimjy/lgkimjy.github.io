---
layout: page
title: Humanoid Localization
description: Vision-based Humanoid Localization in Soccer field for Adult-Size Soccer Competition.
img: assets/img/humanoid_localization/animation.gif
importance: 2
category: robotics
---

### Introduction
The robot’s [decision-making]() is an essential component of the autonomous robot. To fulfil this component, the [accurate position estimation of the robot]() is a fundamental prerequisite. Localization determines the robot’s relative position within the map environment, and existing mobile robots have been extensively studied. However, localization is still [challenging]() to humanoids because the bipeds’ movement is not as stable as mobile robots, and camera view frames oscillate from side to side. Developing [localization]() with high accuracy under the above-limited constraints is necessary. 

---

### Research Goal
Proposes an estimation of a 1.3m tall humanoid robot’s position with an development of [vision-based localization]() in the soccer field. 
* Develop Augmented Monte-Carlo Localization.
* Landmark extraction using CNN-based Object Detection Model.
* Enhancing Data Association method using Hungarian algorithm.
* Estimation in real-time.
* Enable re-estimation after events such as "falling" or "kidnapping" due to collisions.

---

### Methods
Augmented MCL estimates the robot’s position through a recursive prediction and correction process. It uses particle samples scattered in the environment, which are updated based on the sample [motion model]() and measured for their likelihood using the [measurement model](). Samples with low similarity will be discarded during [resampling](), and high- weighted particles will be reassigned for the next prediction step. Also, aMCL will track the [long-term]() and [short-term average weight]() to survive the kidnap problem.

1. Constructing a **[motion model]()** for prediction ( ZMP trajectory )
2. Creating a **[sensor model]()** for estimation ( Deep learning-based object detection )
3. **[Data Association]()** between keypoints and landmarks ( Hungarian method )
4. Particle sample **[weights calculation]()** ( Multi-variant Gaussian function )
5. **[Resampling]()** for the next prediction ( Roulette Wheel )
6. **[Tracking short-]()** and **[long-term weights]()** for adressing Kidnap problem

<div class="row justify-content-center">
    <div class="col-sm-8 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/frames_w_robot.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Robot Configuration, transformation between camera and base footprint frame.
        </div>
    </div>
    <div class="col-sm-4 mt-md-2">
        {% include figure.html path="assets/img/humanoid_localization/landmark_detectiion_result.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Outlines pre-defined keypoints on the soccer field, with different shapes indicating different intersection types.
        </div>
    </div>
</div>

<div class="row justify-content-center">
    <div class="col-sm-12 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/data_association_horizontal.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            The results of data association when using the NN and Hungarian methods, and each row represents different scenarios.
        </div>
    </div>
</div>


---

### Simulation
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/scene1_4_result(0.234m).png" title="example image" class="img-fluid rounded z-depth-1" zoomable=true%}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/scene4_7_result(0.213m).png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
    </div>
</div>
<div class="caption">
    The Localization results in a simulated environment. The <b>estimated position</b> of the robot is shown in <b><font color='BFBF00'>yellow</font></b> on the field image, which follows <b><font color='blue'>blue</font></b>(<b>ground truth</b>) well, in contrast to the <b><font color='red'>red</font></b>, which represents the <b>kinematically accumulated position</b>.
</div>

---

### Real-World Experiments
<div class="row justify-content-sm-center">
    <div class="col-sm-12 mt-3 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/real-world.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Real-World localization in fully autonomous robot plays Soccer. <a href="https://www.youtube.com/watch?v=R78u-vm5boU">(video)</a>
        </div>
    </div>
</div>
<div class="row justify-content-sm-center">
    <div class="col-sm-7 mt-3 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/yolo-detec-real1.png" title="example image" class="img-fluid rounded z-depth-1" %}
        <div class="caption">
            Keypoint detection using the YOLOv4-tiny model in the real-world.
        </div>
    </div>
    <div class="col-sm-5 mt-3 mt-md-1">
        {% include figure.html path="assets/img/humanoid_localization/real_world1.png" title="example image" class="img-fluid rounded z-depth-1" %}
        <div class="caption">
            The localization results when the robot has completed an entire circuit of the soccer field.
        </div>
    </div>
</div>


---

### Results
* **<span style='color: #1b80d2;'>Precise position estimation</span>** in noisy environments like soccer fields. 
* Successfuly applied **<span style='color: #1b80d2;'>Hungarian Method</span>** and deep learning-based
**<span style='color: #1b80d2;'>object detecion</span>** for real-time use.
* Used in RoboCup 2022 Bangkok, and won Adult-Szie Humanoid Soccer Competition,  **<span style='color: #1b80d2;'>2nd Place</span>**.

<div class="row justify-content-sm-center">
    <div class="col-sm-6 mt-3 mt-md-2">
        {% include figure.html path="assets/img/humanoid_localization/RoboCup2022.png" title="example image" class="img-fluid rounded z-depth-1" zoomable=true%}
    </div>
    <div class="col-sm-6 mt-3 mt-md-0">
        {% include figure.html path="assets/img/humanoid_localization/RoboCup_Humanoid League_Certificate_2022_2nd.png" title="example image" class="img-fluid rounded z-depth-1"%}
    </div>
</div>