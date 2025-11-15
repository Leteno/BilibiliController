# Bilibili 遥控器

> 电视机接上电脑，打开 B 站，躺在沙发，想视频快进？你需要 "Bilibili 遥控器"

![demo](misc/demo.png)

## Step

1. install chrome_extension in Chrome/Edge

```
chrome://extesions => "Developer mode" => "Load unpacked" => select the folder of chrome_extension/
```

2. run python_server in your computer

```
docker-compose up --build
```

然而，docker 虚拟容器内模拟键盘点击是无效的，所以如果想体验 “全屏” 这类需要模拟键盘点击的功能，建议直接本机环境下:
```
cd python_server/
# pip install -r requirements.txt
python main.py
```

3. Firewall, allow port 5000

```
Press Win key
=> "Windows Defender Firewall with Advanced Security"
=> "Inbound Rules"
=> "New Rule"
=> "Port", "5000", "Allow the connection", "Private" Only!!!
```

4. Try in your phone!

* 点击插件按钮，拿起微信，即可扫一扫 :D

![微信扫一扫](misc/qrcode.png)

## Yet Another Bilibili Controller

> 明明有 Bilibili 自己的投屏软件了，为啥要做这个

* 家里电视比较老，不支持 Bilibili 投屏。。。
* 通道建好了，之后可以自定义功能啦
