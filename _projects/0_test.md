---
layout: page
title: "testdaddadㅇㅁㅇ"
description: UWB-based Wireless Positioning System.
img: assets/img/balloon_drone/masan.gif
importance: 3
category: robotics
# related_publications: einstein1956investigations, einstein1950meaning
---

# Precision Positioning
* Development of precision positioning technology using UWB

## Main Content

- Development and performance testing of positioning technology through UWB sensors

## Development Environment and Sensors

- OS: ubuntu 20.04
- Language: C++
- UWB Sensor: POZYX Enterprise Kit (Anchor, Tag, Gateway)

<div class="row justify-content-center">
    <div style="width: 200px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Experimental environment configuration.
        </div>
    </div>
    <div style="width: 200px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 1.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Filtered output of tag position (z, x, y)
        </div>
    </div>
    <div style="width: 200px;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 2.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Filtered output of tag position (z, x, y)
        </div>
    </div>
</div>

## Development Goals

- The goal is to appropriately install anchors in the positioning environment and simultaneously position 50 swarm flying objects.

## Sensor Environment Configuration Method

<div class="row justify-content-center">
    <div style="width: 700px;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 3.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Experimental environment configuration.
        </div>
    </div>
</div>

- The gateway was directly connected to the server computer to extract tag and anchor data.
- Anchors are connected via an Ethernet cable to the gateway, and anchors are connected using a daisy chain.
- Power to the anchor was provided through the POE+ device via an Ethernet cable.
- The distance between anchors was set at intervals of 10m ~ 15m.
- Number of anchors used: 10
- Number of tags used: 50


<div class="row justify-content-center">
    <div style="width: 300px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 4.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Daisy chain configured anchor appearance
        </div>
    </div>
    <div style="width: 400px;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 5.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Actual installation environment configuration appearance
        </div>
    </div>
</div>

## Positioning Mode Selection (TDOA VS TWR)

- Precision positioning using UWB signals is based on the Time-Of-Flight of the signal. One of the challenges of this technology is to synchronize the time for all tags and anchors for positioning. POZYX company has implemented this well, which is why it was selected.
- TDOA (Time Difference of Arrival) is a method where the tag periodically sends a UWB signal to the tag for positioning. Since no signal is received from the tag, it has the advantage of a fast data output cycle and a powerful low-power system. However, since the tag does not receive any signals, the board itself does not know its position.
- TWR (Two Way Ranging) is a method where the tag and anchor both transmit and receive, using the calculated time-of-flight for positioning. Unlike TDOA, since the tag also receives a UWB signal from the anchor, the board itself can extract location data. However, due to the added transmission and reception, there is a lot of data to communicate, which interferes with positioning, and there is a limit to the number of tags that can be used (maximum 10).
- Using TWR for positioning limits the number of controllable swarm flying objects, and the powerful low-power system of TDOA was needed, so TDOA positioning mode was ultimately selected for development.

<div class="row justify-content-center">
    <div style="width: 300px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 6.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                TDOA (Time Difference of Arrival)
        </div>
    </div>
    <div style="width: 300px;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 7.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            TWR (Two Way Ranging)
        </div>
    </div>
</div>

## Sensor Data Extraction Protocol (MQTT Protocol)

- The server computer and gateway were directly connected via an Ethernet cable to extract data locally without the internet.
- The protocol used to extract data was the MQTT protocol, which is widely used in IoT, to extract location data and sensor data for each tag.

## Precision Positioning Sensor Filtering Work and Additional Environment Configuration

- To reduce the 10cm error, which is the positioning limit of the existing UWB sensor, the x, y, z data was corrected through a low pass filter.
- It was found that the z-axis height was lower compared to the x, y-axis distances, causing a significant spike in the z-value.

<div class="row justify-content-center">
    <div style="width: 40%; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/trial5_xy.jpg" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Top View showing x,y-axis error within 10cm
        </div>
    </div>
    <div style="width: 40%;">
            {% include figure.html path="assets/img/balloon_drone_test/trial5_yz.jpg" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Large oscillation and error compared to x,y-axis
        </div>
    </div>
</div>

- This was prevented by applying a high gain time constant to the LPF, and the problem was solved by raising the height of the anchor using a PVC pipe. It was determined to be a low-speed flying object, so a high gain time constant was applied.

<div class="row justify-content-center">
    <div style="width: 80%;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 8.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Red: Measured Z value, Blue: Z value corrected through LPF
        </div>
    </div>
</div>

- The position of the tag obtained through filtering was finally estimated for precise positioning through marker and sensor fusion.

## Sensor (Tag) Configuration for Swarm Flight

- 50 tag sensor output cycle: 100HZ → 10HZ
- Since all tags need to be synchronized, if they communicate too quickly, data packets overflow, causing positioning failures.
- To solve this, the entire tag's sensor output cycle was reduced. Picture of tag position when positioning after the entire configuration.

## Test in the Environment Applied to Actual Flying Objects

### Pictures related to Rion's Hall swarm control test

- The entire environment was configured to 20778mm * 26139mm * 3896mm (approximately 21m * 26m * 4m) and positioned the location of 50 tags at the same time.

### MASAN

- The location measurement technology developed was applied to actual flying objects, and the results were satisfactory.
- The location measurement error was within 10cm, and the location measurement was stable without any large oscillation.

<div class="row justify-content-center">
    <div style="width: 260px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/IMG_4914.jpeg" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
                Daisy chain configured anchor appearance
        </div>
    </div>
    <div style="width: 260px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 12.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Actual installation environment configuration appearance
        </div>
    </div>
    <div style="width: 260px;">
            {% include figure.html path="assets/img/balloon_drone_test/Untitled 13.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Actual installation environment configuration appearance
        </div>
    </div>
</div>

<div class="row justify-content-center">
    <div style="width: 395px; margin-right: 10px">
            {% include figure.html path="assets/img/balloon_drone_test/스크린샷(7).png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Actual installation environment configuration appearance
        </div>
    </div>
    <div style="width: 395px;">
            {% include figure.html path="assets/img/balloon_drone_test/스크린샷(8).png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Actual installation environment configuration appearance
        </div>
    </div>
</div>

## [Conclusion](#conclusion)

- The development of precise location measurement technology using UWB sensors was successful.
- The technology can be applied to various fields such as drones, robots, and AR/VR.
- The future direction is to improve the technology and expand its application to various fields.