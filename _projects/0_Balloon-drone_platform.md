---
layout: page
title: Balloon-drone platform for Air Kinetic Art
description: UWB-based Wireless Positioning System.
img: assets/img/balloon_drone/masan.gif
importance: 3
category: robotics
# related_publications: einstein1956investigations, einstein1950meaning
---

## Introduction
* Due to the weight capacity of the balloon-drone, making it impossible to use laser-based sensors.
* Ultra-wideband sensor uses several anchors to position the tag position.

---

## Development Goals
* Robot capable of autonomous navigation to a target location using [real-time positioning]() based on UWB.
* Install anchors properly in positioning environment to [enable tracking]() of 50 swarm balloon-drones for effective [swarm control]().

---

## How?
* Sets up [anchor]() configuration for precise positioning.
* Mount [tag]() to the robot.
* [TDOA]() protocol for swarm positioning (up to 50 drones)
* [TWR]() protocol for single drone control.
<div class="row justify-content-center">
    <div class="col-sm-5">
        {% include figure.html path="assets/img/balloon_drone/tdoa.png" class="img-fluid rounded z-depth-1"  zoomable=true%}
    </div>
    <div class="col-sm-5">
        {% include figure.html path="assets/img/balloon_drone/twr.png" class="img-fluid rounded z-depth-1"  zoomable=true%}
    </div>
</div>
<div class="caption">Left: Time Difference of Arrival (TDoA), Right: Two Way Ranging (TWR)</div>

* Applied complementary filter for IMU calibration, and LPF for strong Z axis oscillations.
* Applied madgwick AHRS filter for align global axes.
<div class="row justify-content-center">
    <div class="col-sm-2 mt-md-0">
        {% include figure.html path="assets/img/balloon_drone/tag.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            TAG
        </div>
    </div>
    <div class="col-sm-2 mt-md-0">
        {% include figure.html path="assets/img/balloon_drone/anchor.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            ANCHOR
        </div>
    </div>
    <div class="col-sm-8 mt-md-0">
        {% include figure.html path="assets/img/balloon_drone/config.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Network Configuration of anchors and tags.
        </div>
    </div>
</div>

---

## Experiment Configurations
### Configuration 1
<div class="row justify-content-center">
    <div style="width: 270px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone/scene2.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Experimental environment configuration.
        </div>
    </div>
    <div style="width: 480px;">
            {% include figure.html path="assets/img/balloon_drone/scene2_output.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Raw Output of tag.
        </div>
    </div>
</div>

### Configuration 2
<div class="row justify-content-center">
    <div style="width: 335px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone/scene1.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Experimental environment configuration.
        </div>
    </div>
    <div style="width: 415px;">
            {% include figure.html path="assets/img/balloon_drone/scene1.gif" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Filtered output of tag position (z, x, y)
        </div>
    </div>
</div>

---

## Implementation for Swarm Control
<div class="row justify-content-center">
    <div class="col-sm-12 mt-md-0">
        {% include figure.html path="assets/img/balloon_drone/experiment.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Experimental environment configuration.
        </div>
    </div>
</div>


---

## Balloon-type drone Implementation
<div class="row justify-content-center">
    <div class="col-sm-12 mt-md-0">
        {% include figure.html path="assets/img/balloon_drone/experiment.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Experimental environment configuration.
        </div>
    </div>
</div>

<div class="row justify-content-center">
        <iframe width="750" height="422" src="https://www.youtube.com/embed/zE13b-hOavc?si=koWjrzdgcxyfvcPq" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        <div class="caption">
            Real-time positioning result, communication via MQTT network.
        </div>
</div>