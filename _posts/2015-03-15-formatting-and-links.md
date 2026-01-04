---
layout: post
title: a post with formatting and links
date: 2015-03-15 16:40:16
description: march & april, looking forward to summer
tags: formatting links
categories: sample-posts
---

* PD control 걸어주면 solve 굉장히 빠름, model infeasible 뜨면 parameter 수정해주면 그만임
* 근데, PD를 걸어준다는건, 강제한다는거고, 그렇게 되면 multiple-mode transition이 생기지 않음,
* So, 나는 빼는게 맞다고 봄, 근데 그렇게 되면 문제를 푸는데 매우매우 느려짐. (MIP Gap 4%인데도 불구하고, 못해도 10-15분 씩 걸림)


* PD 걸어 줬을때는, base support를 넘어갔었는데, pure model-free single integrator로 하면 CoM이 support를 나가지 않음
* 