---
layout: post
title:  "[tips] scp 명령어 사용법"
date: 2022-06-15
# description: this is what included images could look like
tags: linux-tip scp
# categories: sample-posts
# thumbnail: assets/img/9.jpg
---

Secure copy의 줄임말로 ssh를 이용하여 네트워크로 연결된 호스트간에 파일을 주고받는 명령어

```console
// 로컬에서 원격지로 파일 전송
$ scp filename.txt hostname@192.168.10.x:~/.

// 원격지에서 로컬로 파일 전송
$ scp hostname@192.168.10.xxx:~/filename.txt ~/.
```