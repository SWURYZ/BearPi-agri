# BearPi-HM_Nano开发板WiFi编程开发——MQTT连接华为IoT平台
本示例将演示如何在BearPi-HM_Nano开发板上使用MQTT协议连接华为IoT平台,使用的是E53_IA1 智慧农业扩展板与 BearPi-HM_Nano 开发板

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/E53_IA1安装.png "E53_IA1安装")
# 华为IoT平台 API

## 初始化
### 设备信息
> void device_info_init(char *client_id, char * username, char *password);

设置设备信息，在调用oc_mqtt_init()前要先设置设备信息

| **参数**  | **描述**  |
| :-----   | :-----    |
|无         | 无       |
| **返回**  | **描述**  |
|0         | 成功                |
|-1        | 获得设备信息失败      |
|-2        | mqtt 客户端初始化失败 |


### 华为IoT平台 初始化

> int oc_mqtt_init(void);

华为IoT平台初始化函数，需要在使用 华为IoT平台 功能前调用。

| **参数**  | **描述**  |
| :-----   | :-----    |
|无         | 无       |
| **返回**  | **描述**  |
|0         | 成功                |
|-1        | 获得设备信息失败      |
|-2        | mqtt 客户端初始化失败 |

### 设置命令响应函数

> void oc_set_cmd_rsp_cb(void(*cmd_rsp_cb)(uint8_t *recv_data, size_t recv_size, uint8_t **resp_data, size_t *resp_size));

设置命令响应回调函数。

| **参数**    | **描述**    |
| :-----	 | :-----  	   |
|recv_data   | 接收到的数据  |
|recv_size   | 数据的长度    |
|resp_data   | 响应数据      |
|resp_size   | 响应数据的长度 |
| **返回**    | **描述**     |
|无           | 无          |

## 数据上传

### 设备消息上报

> int oc_mqtt_profile_msgup(char *deviceid,oc_mqtt_profile_msgup_t *payload);

是指设备无法按照产品模型中定义的属性格式进行数据上报时，可调用此接口将设备的自定义数据上报给平台，平台将设备上报的消息转发给应用服务器或华为云其他云服务上进行存储和处理。

| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 要上传的消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |

### 设备上报属性数据

> int oc_mqtt_profile_propertyreport(char *deviceid,oc_mqtt_profile_service_t *payload);

用于设备按产品模型中定义的格式将属性数据上报给平台。

| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 要上传的消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |

>**属性上报和消息上报的区别，请查看[消息通信说明](https://support.huaweicloud.com/usermanual-iothub/iot_01_0045_2.html)**

### 网关批量上报属性数据

> int oc_mqtt_profile_gwpropertyreport(char *deviceid,oc_mqtt_profile_device_t *payload);

用于批量设备上报属性数据给平台。网关设备可以用此接口同时上报多个子设备的属性数据。

| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 要上传的消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |

### 属性设置的响应结果

int oc_mqtt_profile_propertysetresp(char *deviceid,oc_mqtt_profile_propertysetresp_t *payload);


| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |

### 属性查询响应结果

> int oc_mqtt_profile_propertygetresp(char *deviceid,oc_mqtt_profile_propertygetresp_t *payload);


| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |

### 将命令的执行结果返回给平台

> int oc_mqtt_profile_cmdresp(char *deviceid,oc_mqtt_profile_cmdresp_t *payload);
平台下发命令后，需要设备及时将命令的执行结果返回给平台，如果设备没回响应，平台会认为命令执行超时。

| **参数**  | **描述**    	|
| :-----   | :-----  	  |
|deviceid     | 设备id       	|
|payload       | 要上传的消息   |
| **返回**  | **描述**     |
|0         | 上传成功 	   |
|1        | 上传失败 	   |



## 软件设计



### 连接平台
在连接平台前需要获取CLIENT_ID、USERNAME、PASSWORD，访问[这里](https://iot-tool.obs-website.cn-north-4.myhuaweicloud.com/)，填写[注册设备](https://support.huaweicloud.com/devg-iothub/iot_01_2127.html#ZH-CN_TOPIC_0240834853__zh-cn_topic_0182125275_section108992615509)后生成的设备ID（DeviceId）和密钥（DeviceSecret），生成连接信息（ClientId、Username、Password）。
```c
WifiConnect("TP-LINK_65A8","0987654321");
device_info_init(CLIENT_ID,USERNAME,PASSWORD);
oc_mqtt_init();
oc_set_cmd_rsp_cb(oc_cmd_rsp_cb);
```

### 推送数据

当需要上传数据时，需要先拼装数据，然后通过oc_mqtt_profile_propertyreport上报数据。代码示例如下： 

```c
static void deal_report_msg(report_t *report)
{
    oc_mqtt_profile_service_t    service;
    oc_mqtt_profile_kv_t         temperature;
    oc_mqtt_profile_kv_t         humidity;
    oc_mqtt_profile_kv_t         luminance;
    oc_mqtt_profile_kv_t         led;
    oc_mqtt_profile_kv_t         motor;


    service.event_time = NULL;
    service.service_id = "Agriculture";
    service.service_property = &temperature;
    service.nxt = NULL;

    temperature.key = "Temperature";
    temperature.value = &report->temp;
    temperature.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    temperature.nxt = &humidity;

    humidity.key = "Humidity";
    humidity.value = &report->hum;
    humidity.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    humidity.nxt = &luminance;

    luminance.key = "Luminance";
    luminance.value = &report->lum;
    luminance.type = EN_OC_MQTT_PROFILE_VALUE_INT;
    luminance.nxt = &led;

    led.key = "LightStatus";
    led.value = g_app_cb.led?"ON":"OFF";
    led.type = EN_OC_MQTT_PROFILE_VALUE_STRING;
    led.nxt = &motor;

    motor.key = "MotorStatus";
    motor.value = g_app_cb.motor?"ON":"OFF";
    motor.type = EN_OC_MQTT_PROFILE_VALUE_STRING;
    motor.nxt = NULL;

    oc_mqtt_profile_propertyreport(USERNAME,&service);
    return;
}
```




### 命令接收

华为IoT平台支持下发命令，命令是用户自定义的。接收到命令后会将命令数据发送到队列中，task_main_entry函数中读取队列数据并调用deal_cmd_msg函数进行处理，代码示例如下： 

```c

void oc_cmd_rsp_cb(uint8_t *recv_data, size_t recv_size, uint8_t **resp_data, size_t *resp_size)
{
	app_msg_t *app_msg;

	int    ret = 0;
	app_msg = malloc(sizeof(app_msg_t));
	app_msg->msg_type = en_msg_cmd;
	app_msg->msg.cmd.payload = (char *)recv_data;

    printf("recv data is %.*s\n", recv_size, recv_data);
    ret = osMessageQueuePut(mid_MsgQueue,&app_msg,0U, 0U);
    if(ret != 0){
        free(recv_data);
    }
    *resp_data = NULL;
    *resp_size = 0;
}
static int task_main_entry( void )
{
    app_msg_t *app_msg;

	WifiConnect("TP-LINK_65A8","0987654321");
	device_info_init(CLIENT_ID,USERNAME,PASSWORD);
	oc_mqtt_init();
	oc_set_cmd_rsp_cb(oc_cmd_rsp_cb);

    while(1){
        app_msg = NULL;
        (void)osMessageQueueGet(mid_MsgQueue,(void **)&app_msg,NULL, 0U);
        if(NULL != app_msg){
            switch(app_msg->msg_type){
                case en_msg_cmd:
                    deal_cmd_msg(&app_msg->msg.cmd);
                    break;
                case en_msg_report:
                    deal_report_msg(&app_msg->msg.report);
                    break;
                default:
                    break;
            }
            free(app_msg);
        }
    }
    return 0;
}
static void deal_cmd_msg(cmd_t *cmd)
{
    cJSON *obj_root;
    cJSON *obj_cmdname;
    cJSON *obj_paras;
    cJSON *obj_para;

    int cmdret = 1;
    oc_mqtt_profile_cmdresp_t  cmdresp;
    obj_root = cJSON_Parse(cmd->payload);
    if(NULL == obj_root){
        goto EXIT_JSONPARSE;
    }

    obj_cmdname = cJSON_GetObjectItem(obj_root,"command_name");
    if(NULL == obj_cmdname){
        goto EXIT_CMDOBJ;
    }
    if(0 == strcmp(cJSON_GetStringValue(obj_cmdname),"Agriculture_Control_light")){
        obj_paras = cJSON_GetObjectItem(obj_root,"paras");
        if(NULL == obj_paras){
            goto EXIT_OBJPARAS;
        }
        obj_para = cJSON_GetObjectItem(obj_paras,"Light");
        if(NULL == obj_para){
            goto EXIT_OBJPARA;
        }
        ///< operate the LED here
        if(0 == strcmp(cJSON_GetStringValue(obj_para),"ON")){
            g_app_cb.led = 1;
            Light_StatusSet(ON);
            printf("Light On!");
        }
        else{
            g_app_cb.led = 0;
            Light_StatusSet(OFF);
            printf("Light Off!");
        }
        cmdret = 0;
    }
    else if(0 == strcmp(cJSON_GetStringValue(obj_cmdname),"Agriculture_Control_Motor")){
        obj_paras = cJSON_GetObjectItem(obj_root,"Paras");
        if(NULL == obj_paras){
            goto EXIT_OBJPARAS;
        }
        obj_para = cJSON_GetObjectItem(obj_paras,"Motor");
        if(NULL == obj_para){
            goto EXIT_OBJPARA;
        }
        ///< operate the Motor here
        if(0 == strcmp(cJSON_GetStringValue(obj_para),"ON")){
            g_app_cb.motor = 1;
            Motor_StatusSet(ON);
            printf("Motor On!");
        }
        else{
            g_app_cb.motor = 0;
            Motor_StatusSet(OFF);
            printf("Motor Off!");
        }
        cmdret = 0;
    }

EXIT_OBJPARA:
EXIT_OBJPARAS:
EXIT_CMDOBJ:
    cJSON_Delete(obj_root);
EXIT_JSONPARSE:
    ///< do the response
    cmdresp.paras = NULL;
    cmdresp.request_id = cmd->request_id;
    cmdresp.ret_code = cmdret;
    cmdresp.ret_name = NULL;
    (void)oc_mqtt_profile_cmdresp(NULL,&cmdresp);
    return;
}
```


## 编译调试


### 登录

设备接入华为云平台之前，需要在平台注册用户账号，华为云地址：<https://www.huaweicloud.com/>

在华为云首页单击产品，找到IoT物联网，单击设备接入IoTDA 并单击立即使用。

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/登录平台01.png "登录平台")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/登录平台02.png "登录平台")

### 创建产品

在设备接入页面可看到总览界面，展示了华为云平台接入的协议与域名信息，根据需要选取MQTT通讯必要的信息备用。

接入协议（端口号）：MQTT 1883

域名：iot-mqtts.cn-north-4.myhuaweicloud.com

选中侧边栏产品页，单击右上角“创建产品”

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品01.png "创建产品")

在页面中选中所属资源空间，并且按要求填写产品名称，选中MQTT协议，数据格式为JSON，并填写厂商名称，在下方模型定义栏中选择所属行业以及添加设备类型，并单击右下角“立即创建”如图：

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品02.png "创建产品")

创建完成后，在产品页会自动生成刚刚创建的产品，单击“查看”可查看创建的具体信息。

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品03.png "创建产品")


单击产品详情页的自定义模型，在弹出页面中新增服务

服务ID：`Agriculture`(必须一致)

服务类型：`Senser`(可自定义)
![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品04.png "创建产品")

在“Agriculture”的下拉菜单下点击“添加属性”填写相关信息“Temperature”，
“Humidity”，“Luminance”，“LightStatus”，“MotorStatus”。


![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品05.png "创建产品")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品06.png "创建产品")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品07.png "创建产品")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品08.png "创建产品")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品09.png "创建产品")

在“Agriculture”的下拉菜单下点击“添加命令”填写相关信息。

命令名称：`Agriculture_Control_light`

参数名称：`Light`

数据类型：`string`

长度：`3`

枚举值：`ON,OFF`

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品10.png "创建产品")

命令名称：`Agriculture_Control_Motor`

参数名称：`Motor`

数据类型：`string`

长度：`3`

枚举值：`ON,OFF`

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/创建产品11.png "创建产品")

#### 注册设备

在侧边栏中单击“设备”，进入设备页面，单击右上角“注册设备”，勾选对应所属资源空间并选中刚刚创建的产品，注意设备认证类型选择“秘钥”，按要求填写秘钥。

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/注册设备01.png "注册设备")

记录下设备ID和设备密钥
![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/注册设备02.png "注册设备")

注册完成后，在设备页面单击“所有设备”，即可看到新建的设备，同时设备处于未激活状态

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/注册设备03.png "注册设备")


### 修改代码中设备信息
在连接平台前需要获取CLIENT_ID、USERNAME、PASSWORD，访问[这里](https://iot-tool.obs-website.cn-north-4.myhuaweicloud.com/)，填写注册设备时生成的设备ID和设备密钥生成连接信息（ClientId、Username、Password），并将修改代码对应位置。
![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/修改设备信息01.png "修改设备信息")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/修改设备信息02.png "修改设备信息")

修改wifi热点信息

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/修改设备信息03.png "修改设备信息")

### 修改代码中平台的对接地址
根据自己使用的平台版本修改`oc_mqtt.h`中第47行附近的平台对接地址。


![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/平台选择.png "平台选择")

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/修改平台对接地址.png "修改平台对接地址")

### 修改 BUILD.gn 文件

修改 `applications\sample\BearPi\BearPi-HM_Nano`路径下 BUILD.gn 文件，指定 `oc_mqtt` 参与编译。

```r
#"D1_iot_wifi_sta:wifi_sta",
#"D2_iot_wifi_sta_connect:wifi_sta_connect",      
#"D3_iot_udp_client:udp_client",
#"D4_iot_tcp_server:tcp_server",
#"D5_iot_mqtt:iot_mqtt",        
"D6_iot_cloud_oc:oc_mqtt",
#"D7_iot_cloud_onenet:onenet_mqtt",
```
示例代码编译烧录代码后，按下开发板的RESET按键，通过串口助手查看日志，会打印温湿度及光照强度信息。
```c
SENSOR:lum:15.83 temp:27.10 hum:39.26

SENSOR:lum:15.83 temp:27.01 hum:39.36

SENSOR:lum:15.83 temp:26.95 hum:39.45

SENSOR:lum:15.83 temp:26.89 hum:39.56

SENSOR:lum:15.83 temp:26.84 hum:39.56

SENSOR:lum:13.33 temp:26.80 hum:39.64

SENSOR:lum:13.33 temp:26.73 hum:39.76

SENSOR:lum:12.50 temp:26.71 hum:39.78

SENSOR:lum:15.83 temp:26.67 hum:39.91

SENSOR:lum:16.67 temp:26.66 hum:40.00
```
平台上的设备显示为在线状态

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/设备在线.png "设备在线")
    
点击设备右侧的“查看”，进入设备详情页面，可看到上报的数据

![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/查看设备信息.png "查看设备信息")

在华为云平台设备详情页，单击“命令”，选择同步命令下发，选中创建的命令属性，单击“确定”，即可发送下发命令控制设备
![](/applications/BearPi/BearPi-HM_Nano/docs/figures/D6_iot_cloud_oc/命令下发.png "命令下发")