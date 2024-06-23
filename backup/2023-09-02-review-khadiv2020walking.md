---
layout: post
title: "[paper review] Walking control based on step timing adaptation"
date: 2023-07-01
description: Propose a novel walking pattern generator that optimally selects step location and timing at every control cycle.
tags: paper-review
# categories: sample-posts
thumbnail: assets/img/review/khadiv2020walking/schematic_view.png
---

## [Abstract](#abstract)
* Step adjustment는 이족 로봇의 보행 견고성을 향상시킬 수 있지만 단계 타이밍의 적응은 여러 발자국에 걸쳐 최적화될 때 볼록하지 않은 문제를 야기하므로 종종 무시됩니다. 
* 본 논문에서는 보행 실행 가능성을 보장하기 위해 여러 단계에 걸쳐 걷기를 최적화할 필요는 없으며 단순히 다음 단계 타이밍과 위치를 선택하는 것만으로도 충분하다는 것을 보여줍니다. 이러한 통찰력을 사용하여 우리는 모든 제어 주기에서 단계 위치와 타이밍을 최적으로 선택하는 새로운 걷기 패턴 생성기를 제안합니다. 우리의 접근 방식은 문헌의 표준 접근 방식에 비해 계산적으로 간단하지만 실행 가능한 상태가 앞으로도 계속 실행 가능함을 보장합니다. 우리는 스윙발 적응 전략을 제안하고 패턴 생성기를 질량 중심이나 발 압력 중심을 명시적으로 제어하지 않는 역동역학 컨트롤러와 통합합니다. 이는 뾰족한 발이나 수동 발목이 있는 로봇과 같이 발 압력 중심에 대한 제어 권한이 제한된 이족 보행 로봇에 특히 유용합니다. 수동 발목이 있는 휴머노이드 로봇에 대한 광범위한 시뮬레이션은 외부 밀기 및 발 미끄러짐을 포함한 다양한 보행 상황에서 접근 방식의 기능을 보여주고 보행을 안정화하기 위한 단계 타이밍 적응의 중요성을 강조합니다.

---

## [Introduction](#introduction)

---

## [Problem Formulation and Viability](#problem-formulation-and-viability)

---

## [Stepping Controller](#stepping-controller)
Stepping Controller는 Fig(2)어서 보여지는 것 처엄 세 가지 메인 stages로 나눠집니다.
* First Stage: 
* Scond Stage:
* Third Stage:

<div class="row justify-content-center">
<div style="width: 480px; margin-right: 10px; margin-top: 0px;">
            {% include figure.html path="assets/img/review/khadiv2020walking/schematic_view.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Fig. 1. Schematic view of walking with footprints, DCM, and DCM offset.
        </div>
    </div>
    <div style="width: 270px; margin-right: 0px; margin-top: 0px;">
            {% include figure.html path="assets/img/review/khadiv2020walking/diagram.png" title="example image" class="img-fluid rounded z-depth-1"  zoomable=true%}
        <div class="caption">
            Fig. 2. Block diagram of the walking algorithm.
        </div>
    </div>
</div>

##### A. Nominal Values for Stepping
##### B. Online foot location and timing adaptation
##### C. Swing foot trajectory adaptation

---

## [Whole-body Control](#whole-body-control)

#### A. Foot trajectory tracking
#### C. Center of Mass height tracking
#### C. Posture control
#### D. Force regularization
#### E. Task hierarchy
