-- 销售事件匹配只读预览（2026-11-21）
-- 仅查询候选，不包含 INSERT、UPDATE、DELETE。
-- 补录前必须核实客户、设备、门店、操作员、收款、积分、国补和售后依据。
SET @preview_only = 1;

-- 缺失销售候选 | SN=359885754674761 | 日期=2025-05-27 | 买家=梁萍 | 手机=13507900730 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='359885754674761' OR c.phone='13507900730' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=861420079763277 | 日期=2025-09-24 | 买家=谢 | 手机=18979071048 | 售价=160.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='861420079763277' OR c.phone='18979071048' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=861426079775479 | 日期=2026-06-01 | 买家=林芳女 | 手机=15279055187 | 售价=170.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='861426079775479' OR c.phone='15279055187' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=861521070640464 | 日期=2026-03-01 | 买家=袁琪 | 手机=15083634349 | 售价=1190.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='861521070640464' OR c.phone='15083634349' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=861521072725602 | 日期=2026-01-12 | 买家=王芳 | 手机=15070141723 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='861521072725602' OR c.phone='15070141723' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C02L7KQEF5V7 | 日期=2024-08-29 | 买家=晏少辉 | 手机=15579025178 | 售价=1380.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C02L7KQEF5V7' OR c.phone='15579025178' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C02T3Y5HYQ/3000 | 日期=2025-03-31 | 买家=黄婧睿 | 手机=13340001527 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C02T3Y5HYQ/3000' OR c.phone='13340001527' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C1FYRYGX9C | 日期=2026-01-06 | 买家=李华 | 手机=15979889399 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C1FYRYGX9C' OR c.phone='15979889399' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C22QGQCC2C | 日期=2026-01-19 | 买家=余亮 | 手机=13767877717 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C22QGQCC2C' OR c.phone='13767877717' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C2CT66C9Y1 | 日期=2023-09-29 | 买家=黄 | 手机=13237541161 | 售价=4900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C2CT66C9Y1' OR c.phone='13237541161' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C2J34VKT27 | 日期=2024-02-16 | 买家=杜凯琳 | 手机=13667903571 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C2J34VKT27' OR c.phone='13667903571' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C2MXH9WQ4J | 日期=2022-07-12 | 买家=刘艳老公 | 手机=15880069412 | 售价=4200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C2MXH9WQ4J' OR c.phone='15880069412' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C2Q6WT3G6K | 日期=2025-12-24 | 买家=曾萍 | 手机=18607995955 | 售价=10999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C2Q6WT3G6K' OR c.phone='18607995955' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C35M902DFRC6 | 日期=2016-01-24 | 买家=彭琼 | 手机=13979030776 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C35M902DFRC6' OR c.phone='13979030776' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C35P2MDJG5MQ | 日期=2016-01-29 | 买家=黄圣 | 手机=13755550873 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C35P2MDJG5MQ' OR c.phone='13755550873' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C37VTDZRJCLY | 日期=2021-01-11 | 买家=张旭 | 手机=18579005609 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C37VTDZRJCLY' OR c.phone='18579005609' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C37VTY8AJCLY | 日期=2021-10-12 | 买家=严家阳 | 手机=17356776788 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C37VTY8AJCLY' OR c.phone='17356776788' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C37X81U0KPGQ | 日期=2019-02-02 | 买家=熊湾 | 手机=15279501832 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C37X81U0KPGQ' OR c.phone='15279501832' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C37X81UMKPGQ | 日期=2025-05-07 | 买家=微商 | 手机=13207903333 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C37X81UMKPGQ' OR c.phone='13207903333' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38K4AG6DTTN | 日期=2025-01-24 | 买家=刘嘉阳 | 手机=13133907760 | 售价=350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38K4AG6DTTN' OR c.phone='13133907760' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38P1SP5G5MQ | 日期=2017-06-27 | 买家=钟志勇 | 手机=18679061333 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38P1SP5G5MQ' OR c.phone='18679061333' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38PVEZ8G5QT | 日期=2023-05-28 | 买家=卢小思 | 手机=18079001114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38PVEZ8G5QT' OR c.phone='18079001114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38T6SX7HFXW | 日期=2023-10-19 | 买家=钟福牙 | 手机=13879035769 | 售价=750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38T6SX7HFXW' OR c.phone='13879035769' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38VL1JDJCM1 | 日期=2023-10-18 | 买家=拉哥 | 手机=18979013838 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38VL1JDJCM1' OR c.phone='18979013838' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38W2P3LJCLY | 日期=2018-05-26 | 买家=钟小惠 | 手机=15607099111 | 售价=5750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38W2P3LJCLY' OR c.phone='15607099111' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38W4BZ5JCLY | 日期=2022-01-28 | 买家=彭家男 | 手机=13755702006 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38W4BZ5JCLY' OR c.phone='13755702006' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38XCWLAKPGQ | 日期=2023-02-25 | 买家=韩闽坤 | 手机=13617901956 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38XCWLAKPGQ' OR c.phone='13617901956' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C38XDBJNKPGQ | 日期=2023-07-25 | 买家=谢如美 | 手机=13517906273 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C38XDBJNKPGQ' OR c.phone='13517906273' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39CK31HN6YL | 日期=2022-02-08 | 买家=刘诚 | 手机=18679092667 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39CK31HN6YL' OR c.phone='18679092667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39P2SVCG5MQ | 日期=2016-11-28 | 买家=梁斌 | 手机=18873828307 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39P2SVCG5MQ' OR c.phone='18873828307' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39PP4JAG5QT | 日期=2017-10-26 | 买家=兰霞 | 手机=13755573433 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39PP4JAG5QT' OR c.phone='13755573433' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39RV64EGRX5 | 日期=2016-12-12 | 买家=钟金渔 | 手机=18397908387 | 售价=3750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39RV64EGRX5' OR c.phone='18397908387' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39T2JAFHFXW | 日期=2023-03-15 | 买家=拉哥 | 手机=18979013838 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39T2JAFHFXW' OR c.phone='18979013838' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39T5U9YHFXW | 日期=2021-11-01 | 买家=钟玉婷 | 手机=15070900210 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39T5U9YHFXW' OR c.phone='15070900210' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39T7C95HG00 | 日期=2021-04-25 | 买家=刘正鑫 | 手机=13539133098 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39T7C95HG00' OR c.phone='13539133098' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39V4BYRJCLY | 日期=2022-06-06 | 买家=高兵华 | 手机=19907902180 | 售价=1350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39V4BYRJCLY' OR c.phone='19907902180' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39V80Y4JCLQ | 日期=2022-02-23 | 买家=冉学文 | 手机=18979036351 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39V80Y4JCLQ' OR c.phone='18979036351' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39VRNAEJCL8 | 日期=2021-11-18 | 买家=小武 | 手机=18707907767 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39VRNAEJCL8' OR c.phone='18707907767' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39WG12ZJCM1 | 日期=2023-01-17 | 买家=谢松 | 手机=18578422142 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39WG12ZJCM1' OR c.phone='18578422142' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39XF1M1KPGW | 日期=2024-05-18 | 买家=周梦雪 | 手机=19256511805 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39XF1M1KPGW' OR c.phone='19256511805' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39XHFZ2KPH6 | 日期=2025-08-16 | 买家=潘杰 | 手机=19107904150 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39XHFZ2KPH6' OR c.phone='19107904150' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C39XHFZ2KPH6 | 日期=2025-10-17 | 买家=欧阳诗琪 | 手机=19070814885 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39XHFZ2KPH6' OR c.phone='19070814885' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C39Y80XGKPFT | 日期=2022-10-12 | 买家=王征 | 手机=18870152964 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C39Y80XGKPFT' OR c.phone='18870152964' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C3X9XVHQ93 | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C3X9XVHQ93' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C5273R72JT | 日期=2026-02-23 | 买家=江姣 | 手机=18770108893 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C5273R72JT' OR c.phone='18770108893' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C5H4G9CY45 | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=8800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C5H4G9CY45' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C6GDQC331Y | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6GDQC331Y' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KC28R8N73Y | 日期=2022-03-29 | 买家=龚志琪 | 手机=15180066088 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KC28R8N73Y' OR c.phone='15180066088' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KQGNUWGRY8 | 日期=2019-04-01 | 买家=任阳 | 手机=18279050723 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KQGNUWGRY8' OR c.phone='18279050723' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KQGVLXGRY5 | 日期=2018-09-10 | 买家=张云根 | 手机=13207900986 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KQGVLXGRY5' OR c.phone='13207900986' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KQGVLXGRY5 | 日期=2019-03-25 | 买家=彭琼 | 手机=13979030776 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KQGVLXGRY5' OR c.phone='13979030776' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KRDHCTGRY7 | 日期=2019-04-23 | 买家=袁成 | 手机=18565707569 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KRDHCTGRY7' OR c.phone='18565707569' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KS75FTHG71 | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KS75FTHG71' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KSCP8MHG74 | 日期=2024-05-02 | 买家=马利平 | 手机=13755541207 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KSCP8MHG74' OR c.phone='13755541207' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KSCWXYHG6W | 日期=2022-02-12 | 买家=张志平 | 手机=18107904381 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KSCWXYHG6W' OR c.phone='18107904381' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KT25H9HG74 | 日期=2022-04-01 | 买家=彭可怡 | 手机=15279053715 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KT25H9HG74' OR c.phone='15279053715' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C6KTR183HG72 | 日期=2022-11-02 | 买家= | 手机=18779007720 | 售价=750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KTR183HG72' OR c.phone='18779007720' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KY84ZMKXM5 | 日期=2021-09-30 | 买家=黄海斌 | 手机=15979880630 | 售价=2488.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KY84ZMKXM5' OR c.phone='15979880630' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KZD7M8N741 | 日期=2024-02-18 | 买家=兰心怡 | 手机=18879049906 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KZD7M8N741' OR c.phone='18879049906' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KZF4RXN73T | 日期=2020-03-23 | 买家=林雨坤 | 手机=17779075080 | 售价=4050.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KZF4RXN73T' OR c.phone='17779075080' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C6KZK0Q5N740 | 日期=2021-12-06 | 买家=钟志名 | 手机=18979038556 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C6KZK0Q5N740' OR c.phone='18979038556' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C76QQ1Y7GRYF | 日期=2021-04-27 | 买家=黄鑫 | 手机=15207909656 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C76QQ1Y7GRYF' OR c.phone='15207909656' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C76RJWT5GRY8 | 日期=2021-01-25 | 买家=夏彤 | 手机=15083610862 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C76RJWT5GRY8' OR c.phone='15083610862' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C77SNF35HG70 | 日期=2023-05-21 | 买家=黄锐曦 | 手机=15070121581 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C77SNF35HG70' OR c.phone='15070121581' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C79TNAPCHXR6 | 日期=2019-09-29 | 买家=袁小芳 | 手机=13767281991 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C79TNAPCHXR6' OR c.phone='13767281991' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C79TPSZEHXR6 | 日期=2020-10-15 | 买家=张海建 | 手机=17779079777 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C79TPSZEHXR6' OR c.phone='17779079777' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C79V22VCHXR6 | 日期=2021-09-19 | 买家=刘妍汐 | 手机=14779918636 | 售价=450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C79V22VCHXR6' OR c.phone='14779918636' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C79V23F7HXR6 | 日期=2021-11-10 | 买家=罗家阳 | 手机=15797600843 | 售价=420.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C79V23F7HXR6' OR c.phone='15797600843' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C7CC36AKN742 | 日期=2022-05-31 | 买家=袁小强 | 手机=18679061619 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CC36AKN742' OR c.phone='18679061619' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CCL56QN741 | 日期=2024-05-09 | 买家=袁礼军 | 手机=18107905391 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CCL56QN741' OR c.phone='18107905391' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CCNPMNN741 | 日期=2021-09-01 | 买家=刘月星 | 手机=18979072095 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CCNPMNN741' OR c.phone='18979072095' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CD81YGN742 | 日期=2021-01-22 | 买家=易璇 | 手机=18870296122 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CD81YGN742' OR c.phone='18870296122' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CV7SW1JC6F | 日期=2021-02-26 | 买家=李博煜 | 手机=13755595529 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CV7SW1JC6F' OR c.phone='13755595529' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C7CVJVSTJC6Q | 日期=2025-01-30 | 买家=郭柯怡 | 手机=15387904115 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CVJVSTJC6Q' OR c.phone='15387904115' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CVL1ZAJC6N | 日期=2024-06-05 | 买家=钟晨辉 | 手机=13361703859 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CVL1ZAJC6N' OR c.phone='13361703859' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C7CVM0SXJC6C | 日期=2018-11-08 | 买家=刘诚 | 手机=18679092667 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CVM0SXJC6C' OR c.phone='18679092667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CWC6XQJC6F | 日期=2024-05-07 | 买家=袁建 | 手机=18279077900 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CWC6XQJC6F' OR c.phone='18279077900' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CX80MBHG72 | 日期=2022-07-22 | 买家=钟晓晓 | 手机=15279070700 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CX80MBHG72' OR c.phone='15279070700' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CZ7SZKN742 | 日期=2024-08-11 | 买家=张绍 | 手机=15180060373 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CZ7SZKN742' OR c.phone='15180060373' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CZCKVYN741 | 日期=2021-09-30 | 买家=熊洁 | 手机=13979051106 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CZCKVYN741' OR c.phone='13979051106' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7CZXFPPN72R | 日期=2024-10-18 | 买家=钟壹衡 | 手机=15347908092 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7CZXFPPN72R' OR c.phone='15347908092' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7DC3BEAN742 | 日期=2024-06-07 | 买家=林钰龙 | 手机=19815177695 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7DC3BEAN742' OR c.phone='19815177695' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7J4YR24FR | 日期=2026-03-08 | 买家=万婷婷 | 手机=19179127679 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7J4YR24FR' OR c.phone='19179127679' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7JPJ4DCG5MQ | 日期=2017-06-23 | 买家=彭文锋 | 手机=18679018228 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7JPJ4DCG5MQ' OR c.phone='18679018228' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C7LVYL90YV | 日期=2025-02-14 | 买家=钟其灵 | 手机=15870093467 | 售价=3750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C7LVYL90YV' OR c.phone='15870093467' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8PV9764JC6T | 日期=2023-05-12 | 买家=何志明 | 手机=15279029636 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PV9764JC6T' OR c.phone='15279029636' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8PVC3CMJC6P | 日期=2025-08-18 | 买家=张 | 手机=13387905155 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PVC3CMJC6P' OR c.phone='13387905155' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8PW15ENJC6T | 日期=2024-07-13 | 买家=袁兴 | 手机=18279070729 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PW15ENJC6T' OR c.phone='18279070729' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=C8PW2HR6JC6C | 日期=2022-11-17 | 买家=钟敏 | 手机=18079018268 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PW2HR6JC6C' OR c.phone='18079018268' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8PWJUE3JWF9 | 日期=2025-10-21 | 买家=微商团队 | 手机=15507906789 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PWJUE3JWF9' OR c.phone='15507906789' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8PYLDFRJC6C | 日期=2022-02-19 | 买家=许齐美 | 手机=13762775626 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8PYLDFRJC6C' OR c.phone='13762775626' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8QD6H23N741 | 日期=2021-01-22 | 买家=肖恋 | 手机=15879940404 | 售价=3950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8QD6H23N741' OR c.phone='15879940404' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8QVFC37JC6F | 日期=2022-02-12 | 买家= | 手机=15070140268 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8QVFC37JC6F' OR c.phone='15070140268' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8QWHFEFJW7 | 日期=2022-11-12 | 买家=林闽军 | 手机=18107909571 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8QWHFEFJW7' OR c.phone='18107909571' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C8QZFEM7N741 | 日期=2021-05-03 | 买家=张志萍 | 手机=18079005109 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C8QZFEM7N741' OR c.phone='18079005109' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=C9J75T64YT | 日期=2026-01-18 | 买家=施倩 | 手机=18879000456 | 售价=5949.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='C9J75T64YT' OR c.phone='18879000456' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CD7N06MHXT | 日期=2024-07-07 | 买家=刘新亮 | 手机=19079029115 | 售价=2350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CD7N06MHXT' OR c.phone='19079029115' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CD9F9FGQDV | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CD9F9FGQDV' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CDC6K4F9N2 | 日期=2026-01-19 | 买家=余亮 | 手机=13767877717 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CDC6K4F9N2' OR c.phone='13767877717' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CFFXKG73H0 | 日期=2025-12-20 | 买家=新凯调货 | 手机=18079124313 | 售价=10999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CFFXKG73H0' OR c.phone='18079124313' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CFLQ7QJ749 | 日期=2025-04-02 | 买家=钟岗 | 手机=13755541595 | 售价=6400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CFLQ7QJ749' OR c.phone='13755541595' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CGXK9QH4L6 | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CGXK9QH4L6' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CH7X6K79DF | 日期=2025-10-27 | 买家=谢威 | 手机=18907900069 | 售价=6300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CH7X6K79DF' OR c.phone='18907900069' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CHQ033Q57N | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CHQ033Q57N' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CJ74465P2F | 日期=2025-08-15 | 买家=林金辉 | 手机=13507900444 | 售价=4350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CJ74465P2F' OR c.phone='13507900444' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CN67G3FKWJ | 日期=2025-11-12 | 买家=黄玉龙 | 手机=15180050525 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CN67G3FKWJ' OR c.phone='15180050525' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CN9WXY7QWM | 日期=2025-11-27 | 买家=陈瑞兴 | 手机=18850202333 | 售价=8500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CN9WXY7QWM' OR c.phone='18850202333' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CQ9MJXDJ6Y | 日期=2023-09-29 | 买家=黄平 | 手机=13650407723 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CQ9MJXDJ6Y' OR c.phone='13650407723' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CQG74L1PFL | 日期=2026-01-21 | 买家=邓江平 | 手机=15207903280 | 售价=8700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CQG74L1PFL' OR c.phone='15207903280' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CQP42H9032 | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CQP42H9032' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CRF030JW06 | 日期=2026-03-24 | 买家=柯珂 | 手机=15894341381 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CRF030JW06' OR c.phone='15894341381' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CWQGWC410Y | 日期=2023-12-09 | 买家=容柳佳 | 手机=13426597507 | 售价=2050.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CWQGWC410Y' OR c.phone='13426597507' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=CXG59J6KX4 | 日期=2025-10-29 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CXG59J6KX4' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CXLLFQNWFM | 日期=2025-03-02 | 买家=李志安 | 手机=16607907715 | 售价=5000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CXLLFQNWFM' OR c.phone='16607907715' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CXVJ7HTXR1 | 日期=2026-01-10 | 买家=欧阳小庆 | 手机=18879034466 | 售价=3400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CXVJ7HTXR1' OR c.phone='18879034466' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=CYWLDH64R | 日期=2025-07-27 | 买家=刘嘉欣 | 手机=15679085361 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='CYWLDH64R' OR c.phone='15679085361' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D03JX37YMJ | 日期=2023-11-21 | 买家=黄鑫之 | 手机=17307909362 | 售价=9400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D03JX37YMJ' OR c.phone='17307909362' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D0X9VJ4G9Y | 日期=2024-10-17 | 买家=赵泽秘 | 手机=19311512096 | 售价=5100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D0X9VJ4G9Y' OR c.phone='19311512096' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=D1276F19RK | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=12150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D1276F19RK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D39M2X26K0 | 日期=2024-11-03 | 买家=袁瑞 | 手机=15096567357 | 售价=8700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D39M2X26K0' OR c.phone='15096567357' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=D4DJ3Q21MW | 日期=2026-02-15 | 买家=长宏调货 | 手机=18679112185 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D4DJ3Q21MW' OR c.phone='18679112185' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D4GCJ9L521 | 日期=2023-07-03 | 买家=曾铭楷 | 手机=13979051223 | 售价=3600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D4GCJ9L521' OR c.phone='13979051223' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=D4QL7VV66V | 日期=2026-03-05 | 买家=李志聪 | 手机=13755374444 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D4QL7VV66V' OR c.phone='13755374444' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=D5631CYQ3J | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D5631CYQ3J' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D6R2LY45GK | 日期=2025-03-07 | 买家=严敏 | 手机=18870279091 | 售价=5100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D6R2LY45GK' OR c.phone='18870279091' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D6TW6H1467 | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=8270.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D6TW6H1467' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D6YT7D6VN9 | 日期=2024-11-13 | 买家=李凤 | 手机=18806940819 | 售价=5000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D6YT7D6VN9' OR c.phone='18806940819' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D7R2YMW0N1 | 日期=2025-11-30 | 买家=叶 | 手机=13307905555 | 售价=4200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D7R2YMW0N1' OR c.phone='13307905555' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=D93YVXYX00 | 日期=2024-11-14 | 买家=周玉林 | 手机=13055219967 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='D93YVXYX00' OR c.phone='13055219967' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DF26MXWR9W | 日期=2026-03-28 | 买家=聂芬 | 手机=18296543836 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DF26MXWR9W' OR c.phone='18296543836' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DFN71PJWR | 日期=2026-02-04 | 买家=李欢 | 手机=18879081285 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DFN71PJWR' OR c.phone='18879081285' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DGWK7Y59NM | 日期=2025-07-04 | 买家=卢娟 | 手机=18679008885 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DGWK7Y59NM' OR c.phone='18679008885' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DKX1W2M4GF | 日期=2026-02-07 | 买家=黄建军 | 手机=18079086644 | 售价=8480.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DKX1W2M4GF' OR c.phone='18079086644' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DMPRFVYZG5W0 | 日期=2023-04-10 | 买家=晏小姐 | 手机=15717900132 | 售价=820.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DMPRFVYZG5W0' OR c.phone='15717900132' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DMPSDWLUG5W3 | 日期=2025-03-13 | 买家=袁 | 手机=18079007372 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DMPSDWLUG5W3' OR c.phone='18079007372' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DMPYJKT6JMVT | 日期=2019-06-26 | 买家=胡书琴 | 手机=15779500266 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DMPYJKT6JMVT' OR c.phone='15779500266' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DMVMC28ZFK14 | 日期=2024-06-27 | 买家=黄淑兰 | 手机=13979079399 | 售价=420.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DMVMC28ZFK14' OR c.phone='13979079399' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPC11B9N73T | 日期=2022-09-03 | 买家=彭瑞颖 | 手机=18079086385 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPC11B9N73T' OR c.phone='18079086385' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPC2DPZN746 | 日期=2020-06-03 | 买家=刘瑶英 | 手机=18379019632 | 售价=3100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPC2DPZN746' OR c.phone='18379019632' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPC2DRYN746 | 日期=2023-01-19 | 买家=钟磊 | 手机=19398563313 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPC2DRYN746' OR c.phone='19398563313' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPCFDEAN741 | 日期=2023-06-27 | 买家=陈佳凯 | 手机=15387807276 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPCFDEAN741' OR c.phone='15387807276' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPCFZG0N741 | 日期=2020-06-25 | 买家=妥国强 | 手机=18153784054 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPCFZG0N741' OR c.phone='18153784054' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPCK8D9N746 | 日期=2023-02-04 | 买家=陈刚一 | 手机=18379020013 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPCK8D9N746' OR c.phone='18379020013' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPCQ8T0N741 | 日期=2025-05-15 | 买家=钟子鑫 | 手机=15279073550 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPCQ8T0N741' OR c.phone='15279073550' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPCQ91KN746 | 日期=2023-01-30 | 买家=兰玉芬 | 手机=15350497209 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPCQ91KN746' OR c.phone='15350497209' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPD61RMN746 | 日期=2020-11-07 | 买家=刘永祥 | 手机=15170133883 | 售价=3900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPD61RMN746' OR c.phone='15170133883' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPDLER20D9G | 日期=2021-10-22 | 买家=清清 | 手机=18379104406 | 售价=5150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPDLER20D9G' OR c.phone='18379104406' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPDNVHB0DYL | 日期=2025-08-14 | 买家=黄爱根 | 手机=1397905122 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPDNVHB0DYL' OR c.phone='1397905122' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPF4A1V0DYP | 日期=2024-01-24 | 买家=邹文涛 | 手机=13657904668 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPF4A1V0DYP' OR c.phone='13657904668' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPFG3HU0DYQ | 日期=2025-09-01 | 买家=李书明 | 手机=15607099918 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPFG3HU0DYQ' OR c.phone='15607099918' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPFLA1K0DYL | 日期=2023-02-22 | 买家=易小刚 | 手机=18397907612 | 售价=5800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPFLA1K0DYL' OR c.phone='18397907612' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPFLA3U0DYL | 日期=2022-05-06 | 买家=罗祖恩 | 手机=13426676486 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPFLA3U0DYL' OR c.phone='13426676486' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPFM5VJ0DYL | 日期=2025-06-15 | 买家=钟泽睿 | 手机=13186800571 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPFM5VJ0DYL' OR c.phone='13186800571' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPP19GEG5MQ | 日期=2020-11-17 | 买家=黄钰淞 | 手机=13979090173 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPP19GEG5MQ' OR c.phone='13979090173' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPQL5BVGRY0 | 日期=2017-12-30 | 买家=施欢欢 | 手机=18179051256 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPQL5BVGRY0' OR c.phone='18179051256' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPQMDXTGRXT | 日期=2018-09-23 | 买家=许志明 | 手机=15779591269 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPQMDXTGRXT' OR c.phone='15779591269' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPR5DDDGRY8 | 日期=2018-11-26 | 买家=谢玉 | 手机=13237555277 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPR5DDDGRY8' OR c.phone='13237555277' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPRM5NCGRYD | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPRM5NCGRYD' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPS74ZVHG82 | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPS74ZVHG82' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSCF63HG85 | 日期=2022-07-19 | 买家=严红园 | 手机=13979076063 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSCF63HG85' OR c.phone='13979076063' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSMB42HG86 | 日期=2021-11-15 | 买家=刘常 | 手机=15180036732 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSMB42HG86' OR c.phone='15180036732' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSN0VUHG6Y | 日期=2017-11-19 | 买家=刘峰 | 手机=18870290900 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSN0VUHG6Y' OR c.phone='18870290900' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSNH4ZHG71 | 日期=2019-07-22 | 买家=夏彬 | 手机=13320005091 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSNH4ZHG71' OR c.phone='13320005091' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSR2YQHG75 | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSR2YQHG75' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPSTDHCHG75 | 日期=2022-08-07 | 买家=小严 | 手机=15779591515 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPSTDHCHG75' OR c.phone='15779591515' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPT1MRKHG71 | 日期=2025-01-03 | 买家=毛毛 | 手机=13979596592 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPT1MRKHG71' OR c.phone='13979596592' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPT1ZKHHG84 | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPT1ZKHHG84' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPT7RX0HG6W | 日期=2017-12-29 | 买家=陈健 | 手机=18870281995 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPT7RX0HG6W' OR c.phone='18870281995' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTDCSSHX96 | 日期=2024-09-01 | 买家=梁先生 | 手机=13225060068 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTDCSSHX96' OR c.phone='13225060068' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTF122HG74 | 日期=2021-10-14 | 买家=王T | 手机=2 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTF122HG74' OR c.phone='2' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTFR4MHX96 | 日期=2021-07-14 | 买家=彭 | 手机=18827909569 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTFR4MHX96' OR c.phone='18827909569' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTGHADHX96 | 日期=2023-02-18 | 买家=幸科毅 | 手机=15007901858 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTGHADHX96' OR c.phone='15007901858' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTK2ADHG84 | 日期=2022-06-04 | 买家=任军波 | 手机=17379001028 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTK2ADHG84' OR c.phone='17379001028' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTL2DGHG82 | 日期=2021-10-15 | 买家=罗焕焕 | 手机=15607903962 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTL2DGHG82' OR c.phone='15607903962' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTPQC8HG71 | 日期=2021-09-22 | 买家=黄小燕 | 手机=15007900014 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTPQC8HG71' OR c.phone='15007900014' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPTQ830HG71 | 日期=2021-10-14 | 买家=王T | 手机=1 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPTQ830HG71' OR c.phone='1' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPV2FBHHG71 | 日期=2024-09-09 | 买家=林滴滴 | 手机=18279081222 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPV2FBHHG71' OR c.phone='18279081222' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPV2PTQHG71 | 日期=2022-01-18 | 买家=张亮 | 手机=153500005518 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPV2PTQHG71' OR c.phone='153500005518' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPVW29BHG71 | 日期=2020-11-24 | 买家=韩晶 | 手机=13755559733 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPVW29BHG71' OR c.phone='13755559733' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPVXR68JCLF | 日期=2022-01-09 | 买家=卢玉琴 | 手机=15570165336 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPVXR68JCLF' OR c.phone='15570165336' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPW3HFAJCLG | 日期=2024-05-07 | 买家=李毅 | 手机=13207902830 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPW3HFAJCLG' OR c.phone='13207902830' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPW5GSDJCLG | 日期=2020-04-22 | 买家=贾磊 | 手机=18607906921 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPW5GSDJCLG' OR c.phone='18607906921' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPWD0XPJCLF | 日期=2020-10-28 | 买家=黄军 | 手机=13506645755 | 售价=1750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPWD0XPJCLF' OR c.phone='13506645755' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPX30EPJCLF | 日期=2020-12-07 | 买家=何勤 | 手机=15180000379 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPX30EPJCLF' OR c.phone='15180000379' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPX4LGDJCLF | 日期=2020-04-28 | 买家=钟小军 | 手机=15279071988 | 售价=2650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPX4LGDJCLF' OR c.phone='15279071988' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPX68F9JCLF | 日期=2021-03-09 | 买家=王子光 | 手机=17679110824 | 售价=1980.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPX68F9JCLF' OR c.phone='17679110824' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPXH1VTKXKP | 日期=2022-06-27 | 买家=林聪 | 手机=15007909251 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPXH1VTKXKP' OR c.phone='15007909251' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPXQ4KTJCLG | 日期=2020-07-20 | 买家=旷欣雨 | 手机=18079056793 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPXQ4KTJCLG' OR c.phone='18079056793' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPY180QJCLF | 日期=2021-04-12 | 买家=安妮 | 手机=15018189785 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPY180QJCLF' OR c.phone='15018189785' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPY493XKXM5 | 日期=2022-04-11 | 买家=张艺瀚 | 手机=19533576887 | 售价=1850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPY493XKXM5' OR c.phone='19533576887' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPYJG91JCLF | 日期=2019-11-04 | 买家=钟涛 | 手机=18679094001 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPYJG91JCLF' OR c.phone='18679094001' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPYL1DUJCL7 | 日期=2023-07-23 | 买家=袁娜娜 | 手机=15170121249 | 售价=1550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPYL1DUJCL7' OR c.phone='15170121249' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZD134N6YL | 日期=2024-07-18 | 买家=钟壹衡 | 手机=15347908092 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZD134N6YL' OR c.phone='15347908092' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZH1C3N6XR | 日期=2026-01-03 | 买家=黄四连 | 手机=13177902912 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZH1C3N6XR' OR c.phone='13177902912' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZKLK5N741 | 日期=2022-11-28 | 买家=倩倩 | 手机=18879031115 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZKLK5N741' OR c.phone='18879031115' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZLB92N73T | 日期=2020-02-20 | 买家=袁徐燕 | 手机=13763996716 | 售价=4600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZLB92N73T' OR c.phone='13763996716' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZV10HN741 | 日期=2023-04-15 | 买家=黄早军 | 手机=15083638532 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZV10HN741' OR c.phone='15083638532' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZV20HN741 | 日期=2023-06-16 | 买家=潘凌宇 | 手机=18807908185 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZV20HN741' OR c.phone='18807908185' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZV2DLN742 | 日期=2022-08-01 | 买家=龚忆佳 | 手机=15180002665 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZV2DLN742' OR c.phone='15180002665' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNPZX24CN742 | 日期=2024-07-18 | 买家=钟壹衡 | 手机=15347908092 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNPZX24CN742' OR c.phone='15347908092' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQDNN7Z0DYL | 日期=2023-12-16 | 买家=陈静娴 | 手机=18870907852 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQDNN7Z0DYL' OR c.phone='18870907852' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQDPMND0DYL | 日期=2024-08-08 | 买家=黄美清 | 手机=13979080358 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQDPMND0DYL' OR c.phone='13979080358' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQDPVJG0DYL | 日期=2025-08-12 | 买家=林建清 | 手机=19271649820 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQDPVJG0DYL' OR c.phone='19271649820' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQF20EZ0DYM | 日期=2023-02-15 | 买家=林金豪 | 手机=18317907706 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQF20EZ0DYM' OR c.phone='18317907706' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQF24N70DYM | 日期=2025-01-20 | 买家=唐左 | 手机=15879930683 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQF24N70DYM' OR c.phone='15879930683' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQF27AD0DYQ | 日期=2024-10-24 | 买家=袁伟 | 手机=18000746566 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQF27AD0DYQ' OR c.phone='18000746566' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQF59HG0DYL | 日期=2025-01-16 | 买家=阿卜力提普 | 手机=19000640531 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQF59HG0DYL' OR c.phone='19000640531' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQPMB4ZG5MN | 日期=2019-08-11 | 买家=朱明 | 手机=13617907576 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQPMB4ZG5MN' OR c.phone='13617907576' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQQF8LEGRY9 | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQQF8LEGRY9' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQQFURCGRYD | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQQFURCGRYD' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQQL1J6GRXV | 日期=2020-04-09 | 买家=张要要 | 手机=15350398518 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQQL1J6GRXV' OR c.phone='15350398518' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQQMR7PGRYC | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQQMR7PGRYC' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQT3WZYHG6W | 日期=2018-04-19 | 买家=刘小明 | 手机=15879672725 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQT3WZYHG6W' OR c.phone='15879672725' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQV2QNZHG6W | 日期=2020-11-25 | 买家=林丹 | 手机=15170141777 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQV2QNZHG6W' OR c.phone='15170141777' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQVVNY6JCLF | 日期=2021-03-12 | 买家=李维群 | 手机=18907901687 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQVVNY6JCLF' OR c.phone='18907901687' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQW6FK4JCLF | 日期=2020-11-28 | 买家=张辉 | 手机=15279088634 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQW6FK4JCLF' OR c.phone='15279088634' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQX453ZJCLF | 日期=2019-05-12 | 买家=林芸 | 手机=18270302870 | 售价=5100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQX453ZJCLF' OR c.phone='18270302870' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQXVYGZJCLG | 日期=2023-12-06 | 买家=袁 | 手机=13979090513 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQXVYGZJCLG' OR c.phone='13979090513' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQZWCMPN742 | 日期=2021-09-26 | 买家=黄清虎 | 手机=18179007651 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQZWCMPN742' OR c.phone='18179007651' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNQZWR1QN741 | 日期=2022-08-09 | 买家=熊欣怡 | 手机=15779596186 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNQZWR1QN741' OR c.phone='15779596186' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRCGMABN741 | 日期=2023-02-05 | 买家=钟婷婷 | 手机=15170140504 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRCGMABN741' OR c.phone='15170140504' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRDNSEY0DYL | 日期=2021-11-02 | 买家=陈默 | 手机=15083634085 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRDNSEY0DYL' OR c.phone='15083634085' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRDPGSS0DYL | 日期=2023-12-04 | 买家=许小亮 | 手机=13479000522 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRDPGSS0DYL' OR c.phone='13479000522' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRDPJUV0DYL | 日期=2022-06-27 | 买家=任汪军 | 手机=15180000099 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRDPJUV0DYL' OR c.phone='15180000099' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRTCUJ9HX96 | 日期=2024-05-04 | 买家=陈明星 | 手机=15679099710 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRTCUJ9HX96' OR c.phone='15679099710' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRTF9SCHX96 | 日期=2024-09-01 | 买家=梁先生 | 手机=13225060068 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRTF9SCHX96' OR c.phone='13225060068' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNRVVAYTJCL6 | 日期=2025-05-13 | 买家=龚小军 | 手机=13979017388 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNRVVAYTJCL6' OR c.phone='13979017388' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNTQFL30GRYD | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNTQFL30GRYD' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DNVZLRWBN741 | 日期=2022-01-08 | 买家=潘嘉乐 | 手机=15180059414 | 售价=2680.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DNVZLRWBN741' OR c.phone='15180059414' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DQ3C4PF26D | 日期=2025-09-20 | 买家=长宏调货 | 手机=18679118711 | 售价=7430.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DQ3C4PF26D' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DQGP5F3YDTWF | 日期=2015-11-14 | 买家=钟春明 | 手机=18907900171 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DQGP5F3YDTWF' OR c.phone='18907900171' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DQGRC08RG5QT | 日期=2016-06-21 | 买家=吴茜 | 手机=15083612232 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DQGRC08RG5QT' OR c.phone='15083612232' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DQGRV2UCG5QW | 日期=2018-02-14 | 买家=林宗生 | 手机=13979041176 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DQGRV2UCG5QW' OR c.phone='13979041176' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DTRRG33GG5QT | 日期=2023-05-28 | 买家=卢小思 | 手机=18079001114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DTRRG33GG5QT' OR c.phone='18079001114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DTRSK2J1G5QY | 日期=2019-07-27 | 买家=王建钊 | 手机=15900258005 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DTRSK2J1G5QY' OR c.phone='15900258005' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DV6H3HDJQ6 | 日期=2024-09-20 | 买家=杨子星 | 手机=17379091231 | 售价=5200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DV6H3HDJQ6' OR c.phone='17379091231' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DVTW6P06TN | 日期=2025-06-09 | 买家=陈 | 手机=15067752157 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DVTW6P06TN' OR c.phone='15067752157' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DVWDJ0QJCP | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DVWDJ0QJCP' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3DQ37FN741 | 日期=2023-01-17 | 买家=曾星晨 | 手机=13217902568 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3DQ37FN741' OR c.phone='13217902568' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3F23DGN741 | 日期=2023-03-11 | 买家=袁子权 | 手机=15180009543 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3F23DGN741' OR c.phone='15180009543' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3F25HKN742 | 日期=2024-01-15 | 买家=吴广平 | 手机=18979472923 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3F25HKN742' OR c.phone='18979472923' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3G1J6A0DYQ | 日期=2024-12-16 | 买家=曾辉 | 手机=13097006100 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3G1J6A0DYQ' OR c.phone='13097006100' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3GKVY0DYL | 日期=2022-10-30 | 买家=刘翔羽 | 手机=17779003111 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3GKVY0DYL' OR c.phone='17779003111' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3P3M8MFRC6 | 日期=2016-01-29 | 买家=胡成 | 手机=13979491996 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3P3M8MFRC6' OR c.phone='13979491996' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3QXK5G5QT | 日期=2019-04-23 | 买家=袁成 | 手机=18565707569 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3QXK5G5QT' OR c.phone='18565707569' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3TL3X2HG00 | 日期=2023-02-11 | 买家=周晨 | 手机=15520452337 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3TL3X2HG00' OR c.phone='15520452337' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3V30KJHG03 | 日期=2018-08-31 | 买家=陈龙英 | 手机=13755551051 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3V30KJHG03' OR c.phone='13755551051' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3WV0Q2HG73 | 日期=2021-10-22 | 买家= | 手机=13879067015 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3WV0Q2HG73' OR c.phone='13879067015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3X412MHG71 | 日期=2018-11-10 | 买家=姚小春 | 手机=13807900167 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3X412MHG71' OR c.phone='13807900167' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3X412MHG71 | 日期=2022-05-25 | 买家=华雕 | 手机=15083966669 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3X412MHG71' OR c.phone='15083966669' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3XG5DRHG6W | 日期=2021-12-02 | 买家=钟伟 | 手机=18870905431 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3XG5DRHG6W' OR c.phone='18870905431' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3XX0V9HG82 | 日期=2024-03-18 | 买家=黄亮 | 手机=13192079812 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3XX0V9HG82' OR c.phone='13192079812' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DX3YP5ZHJCM1 | 日期=2020-11-01 | 买家=邹翔 | 手机=18079006052 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3YP5ZHJCM1' OR c.phone='18079006052' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3Z6NYPKXM5 | 日期=2022-11-02 | 买家=张小昆 | 手机=13617908297 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3Z6NYPKXM5' OR c.phone='13617908297' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3ZG72JKXM0 | 日期=2020-06-19 | 买家=黄金亮 | 手机=17779036555 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3ZG72JKXM0' OR c.phone='17779036555' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX3ZLTK8KXM6 | 日期=2021-10-30 | 买家=钟小惠 | 手机=15607909911 | 售价=2350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX3ZLTK8KXM6' OR c.phone='15607909911' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX4DG1EXN741 | 日期=2024-11-19 | 买家=袁希 | 手机=18079085187 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX4DG1EXN741' OR c.phone='18079085187' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=DX6R373AFR9M | 日期=2016-03-15 | 买家=甘苗苗 | 手机=13755550742 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DX6R373AFR9M' OR c.phone='13755550742' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=DYH54FKGF3 | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=11150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='DYH54FKGF3' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F039XKGFJJ | 日期=2026-02-09 | 买家=邓建民 | 手机=18679091618 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F039XKGFJJ' OR c.phone='18679091618' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17CX00UN6YN | 日期=2022-02-19 | 买家=黄雪儿 | 手机=15083632502 | 售价=3400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17CX00UN6YN' OR c.phone='15083632502' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17D62M1N6YQ | 日期=2020-08-31 | 买家=袁娇 | 手机=13755575215 | 售价=6800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17D62M1N6YQ' OR c.phone='13755575215' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17DKC0Z0DYL | 日期=2024-06-14 | 买家=钟佳敏 | 手机=18979081782 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17DKC0Z0DYL' OR c.phone='18979081782' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17DLG9A0DYM | 日期=2024-09-14 | 买家=严家俊 | 手机=15679057608 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17DLG9A0DYM' OR c.phone='15679057608' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17DPNDJ0D9L | 日期=2025-10-30 | 买家=彭旦 | 手机=13879050555 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17DPNDJ0D9L' OR c.phone='13879050555' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17DVMZ60DYL | 日期=2022-11-07 | 买家=张金生 | 手机=15279025642 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17DVMZ60DYL' OR c.phone='15279025642' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17DWPKX0DYM | 日期=2024-04-26 | 买家=李雅婷 | 手机=13397905716 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17DWPKX0DYM' OR c.phone='13397905716' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17F2F4C0DYL | 日期=2023-01-20 | 买家=袁俊杰 | 手机=13317906302 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17F2F4C0DYL' OR c.phone='13317906302' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17F3WZ40DYM | 日期=2023-09-07 | 买家=林聪 | 手机=15697572893 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17F3WZ40DYM' OR c.phone='15697572893' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17FNXQ60DYL | 日期=2025-02-04 | 买家=李文星 | 手机=18179051380 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17FNXQ60DYL' OR c.phone='18179051380' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17FP21E0DYL | 日期=2022-03-04 | 买家=李子豪 | 手机=18179030193 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17FP21E0DYL' OR c.phone='18179030193' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17FX0K20DYQ | 日期=2025-06-26 | 买家=戴聪 | 手机=1309700282 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17FX0K20DYQ' OR c.phone='1309700282' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17NJ06NG5N0 | 日期=2016-07-09 | 买家=白小燕 | 手机=18079009098 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17NJ06NG5N0' OR c.phone='18079009098' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17QJW5LGRY7 | 日期=2019-09-11 | 买家=秋婷 | 手机=15279062062 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17QJW5LGRY7' OR c.phone='15279062062' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17SM5EFHG72 | 日期=2023-04-09 | 买家=袁勇 | 手机=13340003555 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17SM5EFHG72' OR c.phone='13340003555' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17SW3HTHG71 | 日期=2022-08-07 | 买家=小严 | 手机=15779591515 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17SW3HTHG71' OR c.phone='15779591515' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17T2VEFHG70 | 日期=2018-05-25 | 买家=张华波 | 手机=18190040778 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17T2VEFHG70' OR c.phone='18190040778' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17T472JHG85 | 日期=2021-09-07 | 买家=钟学文 | 手机=17379091916 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17T472JHG85' OR c.phone='17379091916' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17T6ME9HG71 | 日期=2021-10-13 | 买家=王T | 手机=1 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17T6ME9HG71' OR c.phone='1' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17T71A8HG71 | 日期=2023-06-10 | 买家=黄家伟 | 手机=13387907862 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17T71A8HG71' OR c.phone='13387907862' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17TG1BUHX9C | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17TG1BUHX9C' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17TL4CEHG74 | 日期=2023-05-22 | 买家=熬琴 | 手机=18979080660 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17TL4CEHG74' OR c.phone='18979080660' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VCSP6JCLP | 日期=2021-03-21 | 买家=郭小乐 | 手机=15279051026 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VCSP6JCLP' OR c.phone='15279051026' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VN44VJ5KM | 日期=2021-08-13 | 买家=周忠胜 | 手机=13879001586 | 售价=750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VN44VJ5KM' OR c.phone='13879001586' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VN4B3JCM1 | 日期=2018-11-29 | 买家=林雨妹 | 手机=18679002178 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VN4B3JCM1' OR c.phone='18679002178' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VPKWZJCLG | 日期=2020-04-11 | 买家=简添添 | 手机=15083973971 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VPKWZJCLG' OR c.phone='15083973971' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F17VTEGUJCL9 | 日期=2023-04-07 | 买家=黄传明 | 手机=15995488438 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VTEGUJCL9' OR c.phone='15995488438' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VVGU5JCLG | 日期=2020-11-18 | 买家=谢平 | 手机=13177537757 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VVGU5JCLG' OR c.phone='13177537757' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VW6K0JCLG | 日期=2021-06-24 | 买家=杨翠荣 | 手机=18079051010 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VW6K0JCLG' OR c.phone='18079051010' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17VXZC1JCLF | 日期=2021-06-15 | 买家=龚磊 | 手机=18720403396 | 售价=1460.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17VXZC1JCLF' OR c.phone='18720403396' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17W14WPJCLF | 日期=2021-01-21 | 买家=张爱莲 | 手机=13617900266 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17W14WPJCLF' OR c.phone='13617900266' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17W5GQNJCLF | 日期=2020-08-22 | 买家=钟研 | 手机=18879091050 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17W5GQNJCLF' OR c.phone='18879091050' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17WN0TMJCM1 | 日期=2021-02-08 | 买家=黄俊哲 | 手机=18879004408 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17WN0TMJCM1' OR c.phone='18879004408' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17WPL38JCLG | 日期=2021-05-15 | 买家=朱文瑞 | 手机=15279095051 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17WPL38JCLG' OR c.phone='15279095051' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17WRKCMJCLG | 日期=2018-11-25 | 买家=黄淑琴 | 手机=13879090700 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17WRKCMJCLG' OR c.phone='13879090700' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17X2CSFJCLF | 日期=2022-04-17 | 买家=王嘉习 | 手机=18107909697 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17X2CSFJCLF' OR c.phone='18107909697' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17X3TKRJCLG | 日期=2022-05-13 | 买家=钟小斌 | 手机=18979037953 | 售价=950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17X3TKRJCLG' OR c.phone='18979037953' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17XPBDMKXLY | 日期=2023-08-17 | 买家=严亚玲 | 手机=15279000705 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17XPBDMKXLY' OR c.phone='15279000705' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17XQ4F9KXM6 | 日期=2020-11-06 | 买家=周林 | 手机=15387903777 | 售价=6800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17XQ4F9KXM6' OR c.phone='15387903777' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17YG34BKXM6 | 日期=2019-05-30 | 买家= | 手机=15879931915 | 售价=5500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17YG34BKXM6' OR c.phone='15879931915' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17YX3W7KPGQ | 日期=2023-05-21 | 买家=李文杰 | 手机=13979005887 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17YX3W7KPGQ' OR c.phone='13979005887' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17Z10JYKPGQ | 日期=2022-02-08 | 买家=李小明 | 手机=15970296717 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17Z10JYKPGQ' OR c.phone='15970296717' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F17ZPCR0N6YQ | 日期=2024-08-02 | 买家=杨紫玉 | 手机=17779079317 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F17ZPCR0N6YQ' OR c.phone='17779079317' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18DM7Y40DYL | 日期=2025-03-11 | 买家=林珍 | 手机=18676682755 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18DM7Y40DYL' OR c.phone='18676682755' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18F5CV90DYQ | 日期=2024-02-16 | 买家=黄恩泽 | 手机=17379029456 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18F5CV90DYQ' OR c.phone='17379029456' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18FL6PC0DYL | 日期=2021-06-09 | 买家=郭子怡 | 手机=15279001159 | 售价=5400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18FL6PC0DYL' OR c.phone='15279001159' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18QFL64GRYF | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18QFL64GRYF' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18SNH0PHG6W | 日期=2021-02-26 | 买家=林艳 | 手机=17379039566 | 售价=750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18SNH0PHG6W' OR c.phone='17379039566' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18VG1VLJCM1 | 日期=2025-03-12 | 买家=袁雨沫 | 手机=150833613156 | 售价=620.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18VG1VLJCM1' OR c.phone='150833613156' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18W44DFJCLF | 日期=2019-07-10 | 买家=钟志锋 | 手机=18079056888 | 售价=3900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18W44DFJCLF' OR c.phone='18079056888' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F18WNH79JCM1 | 日期=2021-02-03 | 买家=吴莲花 | 手机=18879083177 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F18WNH79JCM1' OR c.phone='18879083177' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F19PT4GJG5MQ | 日期=2016-09-04 | 买家=卢小仁 | 手机=13970493883 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F19PT4GJG5MQ' OR c.phone='13970493883' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F19VD9FLJCM1 | 日期=2020-01-04 | 买家=夏静 | 手机=15979896969 | 售价=3550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F19VD9FLJCM1' OR c.phone='15979896969' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F1DP56BHG5MV | 日期=2017-02-17 | 买家=刘坚 | 手机=13607901568 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F1DP56BHG5MV' OR c.phone='13607901568' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F1HNVPRGG5MQ | 日期=2019-04-23 | 买家=袁成 | 手机=18565707569 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F1HNVPRGG5MQ' OR c.phone='18565707569' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F1HP73V0G5MQ | 日期=2019-11-23 | 买家=晏志亮 | 手机=13755551444 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F1HP73V0G5MQ' OR c.phone='13755551444' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F29DXHF9YR | 日期=2025-03-03 | 买家=李 | 手机=13979071782 | 售价=2050.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F29DXHF9YR' OR c.phone='13979071782' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LCG50WN704 | 日期=2023-02-22 | 买家=易小刚 | 手机=18397907612 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LCG50WN704' OR c.phone='18397907612' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LD71GGN705 | 日期=2023-02-12 | 买家=林志强 | 手机=18879001860 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LD71GGN705' OR c.phone='18879001860' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LDK0NS0D5L | 日期=2021-02-08 | 买家=严亚玲 | 手机=15279000705 | 售价=8500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LDK0NS0D5L' OR c.phone='15279000705' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LDQ0HV0D5G | 日期=2025-04-06 | 买家=曲 | 手机=18979071818 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LDQ0HV0D5G' OR c.phone='18979071818' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LDX5YQ0D5H | 日期=2021-09-26 | 买家=付三石 | 手机=18679002542 | 售价=6200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LDX5YQ0D5H' OR c.phone='18679002542' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LPNF82G5QV | 日期=2018-12-05 | 买家=潘绍忠 | 手机=15825611806 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LPNF82G5QV' OR c.phone='15825611806' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LRF9X5GRX5 | 日期=2020-05-18 | 买家=周慧婷 | 手机=17666508365 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LRF9X5GRX5' OR c.phone='17666508365' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LRK0LQGRWQ | 日期=2020-05-06 | 买家=赵瀛 | 手机=13576475877 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LRK0LQGRWQ' OR c.phone='13576475877' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LRQEDPGRX2 | 日期=2021-02-25 | 买家=张书勤 | 手机=15180021642 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LRQEDPGRX2' OR c.phone='15180021642' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LSP49PHG03 | 日期=2019-01-06 | 买家=林小泉 | 手机=18979010408 | 售价=1650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LSP49PHG03' OR c.phone='18979010408' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LT13TVGRX7 | 日期=2019-11-27 | 买家=钟志刚 | 手机=15350392727 | 售价=1330.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LT13TVGRX7' OR c.phone='15350392727' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LT358HHG00 | 日期=2019-03-18 | 买家=杜盛华 | 手机=15070461961 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LT358HHG00' OR c.phone='15070461961' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LT9DUHHX9F | 日期=2021-11-05 | 买家=胡合斌 | 手机=13755551821 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LT9DUHHX9F' OR c.phone='13755551821' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LTFXM4HX9F | 日期=2021-03-02 | 买家=黄兴全 | 手机=15107902479 | 售价=1350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LTFXM4HX9F' OR c.phone='15107902479' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LV16AUHFM5 | 日期=2021-02-21 | 买家=钟强 | 手机=15180022658 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LV16AUHFM5' OR c.phone='15180022658' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LV8VFBHFM5 | 日期=2019-01-26 | 买家=傅玉琴 | 手机=1508361560 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LV8VFBHFM5' OR c.phone='1508361560' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVD7RUHX9F | 日期=2020-04-16 | 买家=钟凯 | 手机=15717908207 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVD7RUHX9F' OR c.phone='15717908207' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVD9MVHFM5 | 日期=2021-02-19 | 买家=钟诗琦 | 手机=18870904969 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVD9MVHFM5' OR c.phone='18870904969' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVDC2F3CM0 | 日期=2020-10-21 | 买家=黄文飞 | 手机=19804007113 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVDC2F3CM0' OR c.phone='19804007113' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVDC2FJCM0 | 日期=2017-10-01 | 买家=张晚晚 | 手机=18879001787 | 售价=6680.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVDC2FJCM0' OR c.phone='18879001787' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVH6D9JCLF | 日期=2021-02-12 | 买家=夏诗雨 | 手机=15807901197 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVH6D9JCLF' OR c.phone='15807901197' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVHK3UJCM1 | 日期=2019-03-11 | 买家=郭剑英 | 手机=15279020350 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVHK3UJCM1' OR c.phone='15279020350' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LVN5WWJCM1 | 日期=2022-12-12 | 买家=钟亦 | 手机=17379091234 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LVN5WWJCM1' OR c.phone='17379091234' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LW38EAGRXH | 日期=2021-04-21 | 买家=黄超 | 手机=13979040566 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LW38EAGRXH' OR c.phone='13979040566' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LW6ACWJCLF | 日期=2021-06-15 | 买家=刘成浩 | 手机=18397900283 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LW6ACWJCLF' OR c.phone='18397900283' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LWL0VLHFM5 | 日期=2025-02-02 | 买家=刘建华 | 手机=18979051523 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LWL0VLHFM5' OR c.phone='18979051523' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LWNRE2JCM1 | 日期=2020-08-05 | 买家=刘佳欣 | 手机=18879077038 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LWNRE2JCM1' OR c.phone='18879077038' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LWV9VKGRXL | 日期=2023-05-28 | 买家=卢小思 | 手机=18079001114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LWV9VKGRXL' OR c.phone='18079001114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LWVAN1GRXL | 日期=2019-08-18 | 买家=兰桃花 | 手机=18797907776 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LWVAN1GRXL' OR c.phone='18797907776' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LWVBRXJCLG | 日期=2021-10-16 | 买家=单玉欣 | 手机=15679056039 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LWVBRXJCLG' OR c.phone='15679056039' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LX8BUKKPJ2 | 日期=2023-03-11 | 买家=袁昭霞 | 手机=18720954356 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LX8BUKKPJ2' OR c.phone='18720954356' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LXC2V6KPJ1 | 日期=2023-04-21 | 买家=钟勤 | 手机=18979065000 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LXC2V6KPJ1' OR c.phone='18979065000' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LXH2W1KPJ5 | 日期=2023-05-13 | 买家=林欣 | 手机=18720408667 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LXH2W1KPJ5' OR c.phone='18720408667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LXJMV4KPHG | 日期=2022-01-27 | 买家=吴夏芳 | 手机=18279079685 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LXJMV4KPHG' OR c.phone='18279079685' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LXK4VAKXMC | 日期=2021-05-25 | 买家=吴尧生 | 手机=13400653654 | 售价=2450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LXK4VAKXMC' OR c.phone='13400653654' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LYX2KJKPJ1 | 日期=2022-06-20 | 买家=罗子轩 | 手机=15870092842 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LYX2KJKPJ1' OR c.phone='15870092842' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LZ157ZKPJ1 | 日期=2020-11-01 | 买家=袁龙舟 | 手机=17779020531 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LZ157ZKPJ1' OR c.phone='17779020531' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LZ2L78KPJ5 | 日期=2021-09-26 | 买家=刘斌 | 手机=13950443023 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LZ2L78KPJ5' OR c.phone='13950443023' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2LZ6AB9KXK1 | 日期=2021-08-07 | 买家=黄兴学 | 手机=15083603994 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2LZ6AB9KXK1' OR c.phone='15083603994' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MP496KG5QT | 日期=2023-05-28 | 买家=卢小思 | 手机=18079001114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MP496KG5QT' OR c.phone='18079001114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MPD5Q5G5QT | 日期=2015-06-22 | 买家=魏朋不赚钱 | 手机=18270905858 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MPD5Q5G5QT' OR c.phone='18270905858' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MPTZ7YG5QY | 日期=2020-03-31 | 买家=严红艳 | 手机=13387908862 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MPTZ7YG5QY' OR c.phone='13387908862' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MSF4C1HG00 | 日期=2022-12-16 | 买家=袁 | 手机=13588691505 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MSF4C1HG00' OR c.phone='13588691505' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MT2VAWHFXW | 日期=2022-05-19 | 买家=拉哥 | 手机=18979013838 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MT2VAWHFXW' OR c.phone='18979013838' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MTDRBXHX9F | 日期=2018-07-28 | 买家=黄瑾 | 手机=13979081019 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MTDRBXHX9F' OR c.phone='13979081019' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MTJAZRHX9F | 日期=2018-07-31 | 买家=李琳 | 手机=15579036448 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MTJAZRHX9F' OR c.phone='15579036448' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MVT6YYJCLG | 日期=2021-03-27 | 买家=黄朝 | 手机=18607901562 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MVT6YYJCLG' OR c.phone='18607901562' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F2MVT87BJCLG | 日期=2020-02-17 | 买家=林环 | 手机=13958945507 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MVT87BJCLG' OR c.phone='13958945507' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MVVQ6BJCL6 | 日期=2023-02-16 | 买家=潘伟 | 手机=15570166023 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MVVQ6BJCL6' OR c.phone='15570166023' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MVVYMBJCLF | 日期=2021-07-07 | 买家=黄子怡 | 手机=17379060036 | 售价=1875.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MVVYMBJCLF' OR c.phone='17379060036' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MW1AAVJCLF | 日期=2022-07-07 | 买家=林轩智 | 手机=18879082476 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MW1AAVJCLF' OR c.phone='18879082476' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MW5MZXJCLG | 日期=2018-10-31 | 买家=严明 | 手机=13979050601 | 售价=5000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MW5MZXJCLG' OR c.phone='13979050601' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MWDMW3JWLK | 日期=2023-04-12 | 买家=周忠胜 | 手机=13879001585 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MWDMW3JWLK' OR c.phone='13879001585' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MXL2STKXM5 | 日期=2022-02-27 | 买家=马成威 | 手机=18370564563 | 售价=2150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MXL2STKXM5' OR c.phone='18370564563' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2MZ31THKPJ5 | 日期=2021-07-13 | 买家=罗秋生 | 手机=13707955167 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2MZ31THKPJ5' OR c.phone='13707955167' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2NVV2YAJCL6 | 日期=2020-05-29 | 买家=袁园 | 手机=18707907798 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2NVV2YAJCL6' OR c.phone='18707907798' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2NVXFAWJCLF | 日期=2022-01-29 | 买家=黄坤 | 手机=18658380923 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2NVXFAWJCLF' OR c.phone='18658380923' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2PT95TZHX9F | 日期=2021-07-06 | 买家=吴小权 | 手机=18807903995 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2PT95TZHX9F' OR c.phone='18807903995' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2PVVBW8JCL6 | 日期=2025-10-10 | 买家=付钰豪 | 手机=17379089012 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2PVVBW8JCL6' OR c.phone='17379089012' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F2W7XTD7GH | 日期=2025-11-19 | 买家=钟丽平 | 手机=18079038062 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F2W7XTD7GH' OR c.phone='18079038062' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GC271PN741 | 日期=2023-02-22 | 买家=周小武 | 手机=18279061297 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GC271PN741' OR c.phone='18279061297' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GCHPQGN741 | 日期=2025-06-15 | 买家=张绍 | 手机=15180060373 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GCHPQGN741' OR c.phone='15180060373' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GCKP0SN741 | 日期=2026-01-02 | 买家=夏子寒 | 手机=15979874726 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GCKP0SN741' OR c.phone='15979874726' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GCWE2FN741 | 日期=2022-12-25 | 买家=黄嘉琪 | 手机=15807908863 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GCWE2FN741' OR c.phone='15807908863' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GD3HW7N73T | 日期=2025-07-17 | 买家=林 | 手机=18279067866 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GD3HW7N73T' OR c.phone='18279067866' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GD98SMN742 | 日期=2023-08-07 | 买家=吴燕娜 | 手机=15779585844 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GD98SMN742' OR c.phone='15779585844' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F4GDCP3WN742 | 日期=2021-09-28 | 买家=马欢 | 手机=18079063658 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GDCP3WN742' OR c.phone='18079063658' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GDCT66N742 | 日期=2022-11-08 | 买家=林丽 | 手机=13479005858 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GDCT66N742' OR c.phone='13479005858' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GDCXFBN742 | 日期=2021-12-08 | 买家=钟奇 | 手机=13217901392 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GDCXFBN742' OR c.phone='13217901392' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GF989HN741 | 日期=2025-05-12 | 买家=袁甜 | 手机=18389928716 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GF989HN741' OR c.phone='18389928716' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GFL7P5N741 | 日期=2021-07-09 | 买家=袁梦瑶 | 手机=15170901578 | 售价=4700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GFL7P5N741' OR c.phone='15170901578' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GQL9D7GRY7 | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GQL9D7GRY7' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GSH1HDHG79 | 日期=2025-10-16 | 买家=微信团队。 | 手机=15507906789 | 售价=300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GSH1HDHG79' OR c.phone='15507906789' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GSMA33HG72 | 日期=2025-10-10 | 买家=敖 | 手机=18779005210 | 售价=450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GSMA33HG72' OR c.phone='18779005210' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GTVFA1HG6W | 日期=2018-05-09 | 买家=曹青婷 | 手机=13755700925 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GTVFA1HG6W' OR c.phone='13755700925' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GV3N8ZHG71 | 日期=2021-10-22 | 买家= | 手机=13879067015 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GV3N8ZHG71' OR c.phone='13879067015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GV438YHG73 | 日期=2023-09-19 | 买家=陈小娟 | 手机=15258751646 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GV438YHG73' OR c.phone='15258751646' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GVCALLJC6Q | 日期=2023-02-24 | 买家=袁勇 | 手机=13340003555 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GVCALLJC6Q' OR c.phone='13340003555' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GW2EFJJC6F | 日期=2024-03-10 | 买家=邓益群 | 手机=13617903442 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GW2EFJJC6F' OR c.phone='13617903442' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GW9309JC6N | 日期=2025-05-01 | 买家=李雨轩 | 手机=13216317665 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GW9309JC6N' OR c.phone='13216317665' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GW9DAQJC6F | 日期=2018-11-11 | 买家=程传光 | 手机=15606960727 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GW9DAQJC6F' OR c.phone='15606960727' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GWD02QJC6F | 日期=2018-06-14 | 买家=孟祥琪 | 手机=15170144449 | 售价=4650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GWD02QJC6F' OR c.phone='15170144449' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GX3EKCJC6F | 日期=2022-09-20 | 买家=钟志强 | 手机=17779072001 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GX3EKCJC6F' OR c.phone='17779072001' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GXMK57JC6C | 日期=2021-02-07 | 买家=胡淑雅 | 手机=15279054276 | 售价=1250.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GXMK57JC6C' OR c.phone='15279054276' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GY99NVJC6N | 日期=2024-11-18 | 买家=陈阳明 | 手机=15180002895 | 售价=950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GY99NVJC6N' OR c.phone='15180002895' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GZFFG7N73T | 日期=2019-10-07 | 买家=刘志辉 | 手机=15279076770 | 售价=5400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GZFFG7N73T' OR c.phone='15279076770' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4GZRTQAN73Y | 日期=2022-09-13 | 买家=周芳华 | 手机=15180040797 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GZRTQAN73Y' OR c.phone='15180040797' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F4GZT478N742 | 日期=2022-10-15 | 买家=卢功成 | 手机=13879081699 | 售价=2550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4GZT478N742' OR c.phone='13879081699' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4HCHNQJN741 | 日期=2021-08-17 | 买家=朱晓欣 | 手机=15870096879 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4HCHNQJN741' OR c.phone='15870096879' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4HCLE8WN73T | 日期=2021-04-14 | 买家=叶小庆 | 手机=18296200374 | 售价=3100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4HCLE8WN73T' OR c.phone='18296200374' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4HZWF2NN745 | 日期=2023-07-01 | 买家=谢奕星 | 手机=17379082990 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4HZWF2NN745' OR c.phone='17379082990' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4JCL0HLN73T | 日期=2024-02-25 | 买家=钟文才 | 手机=17379053386 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4JCL0HLN73T' OR c.phone='17379053386' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4JQLJR4GRY7 | 日期=2018-06-03 | 买家=瞿宏文 | 手机=15170901195 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4JQLJR4GRY7' OR c.phone='15170901195' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4JW8JL9JC6C | 日期=2023-02-20 | 买家=严先生 | 手机=13879029950 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4JW8JL9JC6C' OR c.phone='13879029950' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4JZX64AN741 | 日期=2020-04-02 | 买家=尕玛曲英 | 手机=13897483666 | 售价=4900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4JZX64AN741' OR c.phone='13897483666' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F4KSMZNJHG6W | 日期=2019-01-05 | 买家=宋金军 | 手机=15279074196 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F4KSMZNJHG6W' OR c.phone='15279074196' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F502V56WTR | 日期=2025-10-30 | 买家=朱志勇 | 手机=15170905822 | 售价=3600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F502V56WTR' OR c.phone='15170905822' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F59K2XV25T | 日期=2023-08-10 | 买家=杨翠荣 | 手机=18079051010 | 售价=10500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F59K2XV25T' OR c.phone='18079051010' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F6CDX6T4DH | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F6CDX6T4DH' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71QHFPXGRYD | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71QHFPXGRYD' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SF2TGHG71 | 日期=2022-07-18 | 买家=钟海平 | 手机=18807901310 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SF2TGHG71' OR c.phone='18807901310' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SH1SEHG75 | 日期=2021-09-05 | 买家=钟学文 | 手机=17379091916 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SH1SEHG75' OR c.phone='17379091916' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SK3H9HG71 | 日期=2024-08-27 | 买家=李成熙 | 手机=15889290794 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SK3H9HG71' OR c.phone='15889290794' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SKAJ8HG75 | 日期=2024-09-09 | 买家=林滴滴 | 手机=18279081222 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SKAJ8HG75' OR c.phone='18279081222' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71STP4ZHG7K | 日期=2021-07-06 | 买家=兰惠林 | 手机=13317900359 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71STP4ZHG7K' OR c.phone='13317900359' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SV0QNHG71 | 日期=2022-03-30 | 买家=吴欣 | 手机=18221413913 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SV0QNHG71' OR c.phone='18221413913' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SW648HG75 | 日期=2024-09-09 | 买家=林滴滴 | 手机=18279081222 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SW648HG75' OR c.phone='18279081222' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71SW9HYHG75 | 日期=2018-10-23 | 买家=彭莲香 | 手机=18679016287 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71SW9HYHG75' OR c.phone='18679016287' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71TH494HG71 | 日期=2023-11-13 | 买家=刘凤 | 手机=15279062633 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71TH494HG71' OR c.phone='15279062633' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71VL286JC6P | 日期=2025-03-07 | 买家=林鹏 | 手机=19174002616 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71VL286JC6P' OR c.phone='19174002616' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71VVJ9FHG7K | 日期=2022-10-05 | 买家=夏侯慈 | 手机=13361702889 | 售价=730.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71VVJ9FHG7K' OR c.phone='13361702889' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71W1559HG71 | 日期=2021-07-01 | 买家=谭志昆 | 手机=15083966015 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71W1559HG71' OR c.phone='15083966015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71WL0KEHG71 | 日期=2022-06-13 | 买家=袁雨晨 | 手机=18579090227 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71WL0KEHG71' OR c.phone='18579090227' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71WP2XFHG7K | 日期=2022-04-14 | 买家=吴燕军 | 手机=15387905287 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71WP2XFHG7K' OR c.phone='15387905287' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71XK0ALKXL9 | 日期=2024-05-06 | 买家=黄聪 | 手机=19977301214 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71XK0ALKXL9' OR c.phone='19977301214' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71Y3G2HHG6W | 日期=2021-10-09 | 买家=张寒 | 手机=18979044211 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71Y3G2HHG6W' OR c.phone='18979044211' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71YD1AEKXLY | 日期=2023-06-02 | 买家=袁旭 | 手机=18679058888 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71YD1AEKXLY' OR c.phone='18679058888' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71YGH8KKXM5 | 日期=2021-07-04 | 买家=黄艺 | 手机=18079030826 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71YGH8KKXM5' OR c.phone='18079030826' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F71Z90FTHG6W | 日期=2022-04-14 | 买家=张高锋 | 手机=18879030588 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F71Z90FTHG6W' OR c.phone='18879030588' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F72QDGWPGRY8 | 日期=2017-12-25 | 买家=黄丹 | 手机=15279061366 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F72QDGWPGRY8' OR c.phone='15279061366' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F72SCDUUHG74 | 日期=2022-04-03 | 买家=钟海平 | 手机=18807901310 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F72SCDUUHG74' OR c.phone='18807901310' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F72SLJ9WHG74 | 日期=2025-04-11 | 买家=夏侯智威 | 手机=19142161618 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F72SLJ9WHG74' OR c.phone='19142161618' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F74SFZFYHG71 | 日期=2023-05-24 | 买家=王 | 手机=19942103210 | 售价=700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F74SFZFYHG71' OR c.phone='19942103210' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F8QR40BNFCM8 | 日期=2022-01-20 | 买家=冉春梅 | 手机=18979059571 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F8QR40BNFCM8' OR c.phone='18979059571' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F9FTC08CGHMN | 日期=2020-07-12 | 买家=袁波 | 手机=13265087796 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F9FTC08CGHMN' OR c.phone='13265087796' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F9FVV6LWGHMN | 日期=2020-07-12 | 买家=袁波 | 手机=13265087796 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F9FVV6LWGHMN' OR c.phone='13265087796' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=F9FWD3PUGHMN | 日期=2020-07-12 | 买家=袁波 | 手机=13265087796 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F9FWD3PUGHMN' OR c.phone='13265087796' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=F9FY586QGHKJ | 日期=2022-09-18 | 买家=袁慧 | 手机=13890811232 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='F9FY586QGHKJ' OR c.phone='13890811232' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCCRK38QGRWQ | 日期=2023-03-25 | 买家=吴先生 | 手机=18779007461 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCCRK38QGRWQ' OR c.phone='18779007461' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCDRR458GRX5 | 日期=2021-02-20 | 买家=袁慧芝 | 手机=13979021947 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCDRR458GRX5' OR c.phone='13979021947' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCFVR01HHFM5 | 日期=2022-10-25 | 买家=梁赘 | 手机=15907904320 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCFVR01HHFM5' OR c.phone='15907904320' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCHTV1WYHFM5 | 日期=2020-08-24 | 买家=彭春英 | 手机=13879011736 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCHTV1WYHFM5' OR c.phone='13879011736' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCLSN1QBGRXL | 日期=2017-02-06 | 买家=易倩 | 手机=13755592355 | 售价=5400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCLSN1QBGRXL' OR c.phone='13755592355' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FCQ59RK7MK | 日期=2025-11-23 | 买家=黄祉欣 | 手机=17687903403 | 售价=3050.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FCQ59RK7MK' OR c.phone='17687903403' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD1W8012JCLY | 日期=2020-12-12 | 买家=刘永祥 | 手机=15170133883 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD1W8012JCLY' OR c.phone='15170133883' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD1X80LCJCM1 | 日期=2020-08-25 | 买家=张晓青 | 手机=15579030505 | 售价=2150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD1X80LCJCM1' OR c.phone='15579030505' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD1YF4TCJCLY | 日期=2023-08-14 | 买家=严润根 | 手机=13979081141 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD1YF4TCJCLY' OR c.phone='13979081141' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2CKG6VN1YP | 日期=2021-08-03 | 买家=曾宏超 | 手机=15083645478 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2CKG6VN1YP' OR c.phone='15083645478' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2W5E2AJCM1 | 日期=2022-12-21 | 买家=钟红根 | 手机=17779022110 | 售价=950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2W5E2AJCM1' OR c.phone='17779022110' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FD2XD0EEJCLY | 日期=2021-01-01 | 买家=袁艺娇 | 手机=15170140840 | 售价=1699.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2XD0EEJCLY' OR c.phone='15170140840' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2XD3BLJCLY | 日期=2022-09-12 | 买家=郭镇南 | 手机=15180000332 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2XD3BLJCLY' OR c.phone='15180000332' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2Y26J6JCM1 | 日期=2021-12-05 | 买家=王斌 | 手机=15070144003 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2Y26J6JCM1' OR c.phone='15070144003' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2Y905RJCLY | 日期=2019-04-12 | 买家= | 手机=13979091889 | 售价=4900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2Y905RJCLY' OR c.phone='13979091889' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD2Z549JJCM1 | 日期=2022-07-07 | 买家=付阳 | 手机=16750080299 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD2Z549JJCM1' OR c.phone='16750080299' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD3YQ6FQJCM1 | 日期=2019-07-10 | 买家=钟志荣 | 手机=17779027123 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD3YQ6FQJCM1' OR c.phone='17779027123' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD3Z52Q7JCM1 | 日期=2021-01-29 | 买家=钟昆 | 手机=15083621232 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD3Z52Q7JCM1' OR c.phone='15083621232' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD6VQ1FQJCM1 | 日期=2021-08-06 | 买家=周艳 | 手机=18979025533 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD6VQ1FQJCM1' OR c.phone='18979025533' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD6W54FTJCM1 | 日期=2021-05-07 | 买家=伍宾 | 手机=15707900979 | 售价=1650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD6W54FTJCM1' OR c.phone='15707900979' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD7VM1TJJCLP | 日期=2022-02-17 | 买家=蓝波 | 手机=18925219781 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD7VM1TJJCLP' OR c.phone='18925219781' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FD9Y70YKJCM0 | 日期=2021-11-06 | 买家=曾光宇 | 手机=13617907704 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FD9Y70YKJCM0' OR c.phone='13617907704' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDCY40AJJCLY | 日期=2022-09-29 | 买家=黄文君 | 手机=18579096760 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDCY40AJJCLY' OR c.phone='18579096760' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDNRP2RNG5MQ | 日期=2016-07-24 | 买家=陈建兵 | 手机=13979010736 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDNRP2RNG5MQ' OR c.phone='13979010736' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDPRM0W3G5MQ | 日期=2020-07-11 | 买家=林小刚 | 手机=15180031887 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDPRM0W3G5MQ' OR c.phone='15180031887' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDRR14KG5MQ | 日期=2018-08-20 | 买家=刘超 | 手机=18870285522 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDRR14KG5MQ' OR c.phone='18870285522' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDRR15WDG5MQ | 日期=2021-03-21 | 买家=陈俊杰 | 手机=13207908619 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDRR15WDG5MQ' OR c.phone='13207908619' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FDRR21Q2G5MQ | 日期=2019-06-30 | 买家=袁娟 | 手机=13755550998 | 售价=550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FDRR21Q2G5MQ' OR c.phone='13755550998' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FF277MQ7RN | 日期=2024-07-21 | 买家=王洋 | 手机=18079048285 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FF277MQ7RN' OR c.phone='18079048285' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FF947WC442 | 日期=2025-09-04 | 买家=长宏调货 | 手机=18679118711 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FF947WC442' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMCC0N7N1MW | 日期=2024-05-02 | 买家=黄建军 | 手机=13407900335 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMCC0N7N1MW' OR c.phone='13407900335' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMDN20A0DYL | 日期=2023-08-12 | 买家=袁振伟 | 手机=18707900661 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMDN20A0DYL' OR c.phone='18707900661' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMQP4SSG5MQ | 日期=2019-03-23 | 买家=胡鹏 | 手机=15979891819 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMQP4SSG5MQ' OR c.phone='15979891819' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMQRFFWG5MV | 日期=2024-01-20 | 买家=尹 | 手机=19907902667 | 售价=150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMQRFFWG5MV' OR c.phone='19907902667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMRVJ9BGRY8 | 日期=2016-08-11 | 买家=罗海涛 | 手机=15679093880 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMRVJ9BGRY8' OR c.phone='15679093880' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMRXPPHGRY7 | 日期=2017-04-26 | 买家=严亚玲 | 手机=15279000705 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMRXPPHGRY7' OR c.phone='15279000705' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMSJ3W0GRYF | 日期=2017-05-26 | 买家=严明 | 手机=13979050601 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMSJ3W0GRYF' OR c.phone='13979050601' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMSK40VGRYG | 日期=2019-06-16 | 买家=徐 | 手机=18907900320 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMSK40VGRYG' OR c.phone='18907900320' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMSL7HYGRY8 | 日期=2020-04-06 | 买家=刘海英 | 手机=18779000915 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMSL7HYGRY8' OR c.phone='18779000915' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMSL7HYGRY8 | 日期=2023-05-28 | 买家=卢小思 | 手机=18079001114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMSL7HYGRY8' OR c.phone='18079001114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMTPC28HXR6 | 日期=2021-04-09 | 买家=钟安娜 | 手机=18379079879 | 售价=400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMTPC28HXR6' OR c.phone='18379079879' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMVC9MHJC6C | 日期=2021-02-23 | 买家=刘明 | 手机=15770938050 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMVC9MHJC6C' OR c.phone='15770938050' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMVM5LXHG72 | 日期=2021-11-06 | 买家=袁 | 手机=19942103210 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMVM5LXHG72' OR c.phone='19942103210' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMW66VUJC6F | 日期=2021-01-31 | 买家=辛智 | 手机=13755594156 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMW66VUJC6F' OR c.phone='13755594156' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMXME84JC6F | 日期=2024-01-21 | 买家=朱小斌 | 手机=18979037953 | 售价=650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMXME84JC6F' OR c.phone='18979037953' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMY3EZGJC6F | 日期=2024-11-09 | 买家=袁佳俊 | 手机=15083609391 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMY3EZGJC6F' OR c.phone='15083609391' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYD17LJC6C | 日期=2021-12-15 | 买家=袁 | 手机=14797900138 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYD17LJC6C' OR c.phone='14797900138' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYD17LJC6C | 日期=2021-12-19 | 买家=黄新平 | 手机=18770902459 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYD17LJC6C' OR c.phone='18770902459' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYDBTFJC6C | 日期=2022-11-01 | 买家=钟传芳 | 手机=13979060181 | 售价=850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYDBTFJC6C' OR c.phone='13979060181' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYP11SJC6C | 日期=2021-09-28 | 买家=欧阳长女 | 手机=15083962225 | 售价=1150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYP11SJC6C' OR c.phone='15083962225' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYPSSWJC6C | 日期=2019-07-02 | 买家=严小佩 | 手机=18879017656 | 售价=3400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYPSSWJC6C' OR c.phone='18879017656' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYQ5H3KPJ5 | 日期=2025-09-28 | 买家=张丽婷 | 手机=18308739932 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYQ5H3KPJ5' OR c.phone='18308739932' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYT4D2KPJ2 | 日期=2022-06-23 | 买家=刘勇详 | 手机=15170133883 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYT4D2KPJ2' OR c.phone='15170133883' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMYV3TMKPJ1 | 日期=2019-07-05 | 买家=钟耀庭 | 手机=13049341022 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMYV3TMKPJ1' OR c.phone='13049341022' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFMZNB1PN1MY | 日期=2023-04-15 | 买家=彭美 | 手机=15083630292 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFMZNB1PN1MY' OR c.phone='15083630292' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNDLEVV0DYP | 日期=2022-05-04 | 买家=张依然 | 手机=18979017082 | 售价=3550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNDLEVV0DYP' OR c.phone='18979017082' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNT8A9UHXR6 | 日期=2019-09-23 | 买家=王军 | 手机=18857786929 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNT8A9UHXR6' OR c.phone='18857786929' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNTNR30HXR6 | 日期=2017-06-12 | 买家=钟春燕 | 手机=18607901986 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNTNR30HXR6' OR c.phone='18607901986' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNVF35FJC6F | 日期=2020-09-08 | 买家=袁伟民 | 手机=15070136744 | 售价=1550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNVF35FJC6F' OR c.phone='15070136744' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNVV2R4HXR6 | 日期=2020-12-24 | 买家=周水连 | 手机=18779010872 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNVV2R4HXR6' OR c.phone='18779010872' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNXQEUCJC6C | 日期=2022-10-09 | 买家=韩传智 | 手机=15717906668 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNXQEUCJC6C' OR c.phone='15717906668' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFNYF07QJC6C | 日期=2021-03-15 | 买家=龙瑞兵 | 手机=13217903316 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFNYF07QJC6C' OR c.phone='13217903316' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFPQ83NXG5MQ | 日期=2015-10-27 | 买家=潘艳 | 手机=13707900861 | 售价=4200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFPQ83NXG5MQ' OR c.phone='13707900861' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFPQMHW4G5MQ | 日期=2018-08-07 | 买家=兰天奇 | 手机=15083960987 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFPQMHW4G5MQ' OR c.phone='15083960987' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFPVFFWQJC6C | 日期=2022-12-09 | 买家=李军 | 手机=18979031117 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFPVFFWQJC6C' OR c.phone='18979031117' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFPW2442HXR6 | 日期=2020-08-27 | 买家=钟小惠 | 手机=15607099111 | 售价=500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFPW2442HXR6' OR c.phone='15607099111' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFVDK62B0DYL | 日期=2021-10-06 | 买家=钟淑娟 | 手机=18870290977 | 售价=4250.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFVDK62B0DYL' OR c.phone='18870290977' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFVG241F0DYM | 日期=2023-05-27 | 买家=林丽丽 | 手机=15180000881 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFVG241F0DYM' OR c.phone='15180000881' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFVQMBMHG5MQ | 日期=2024-01-20 | 买家=尹 | 手机=19907902667 | 售价=150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFVQMBMHG5MQ' OR c.phone='19907902667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWDND570DYL | 日期=2022-06-20 | 买家=袁青云 | 手机=15679071667 | 售价=3600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWDND570DYL' OR c.phone='15679071667' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWFCS8FN741 | 日期=2022-10-11 | 买家=黄 | 手机=15107905366 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWFCS8FN741' OR c.phone='15107905366' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWG2K290DYQ | 日期=2022-06-18 | 买家=谢睿智 | 手机=15679006668 | 售价=3600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWG2K290DYQ' OR c.phone='15679006668' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWGN830N742 | 日期=2025-03-16 | 买家=钟嘉兴 | 手机=17521368116 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWGN830N742' OR c.phone='17521368116' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWH2GKWN741 | 日期=2024-03-06 | 买家=刘文杰 | 手机=18179056659 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWH2GKWN741' OR c.phone='18179056659' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWXH63LKPHH | 日期=2022-05-06 | 买家=周慧琳 | 手机=17779014373 | 售价=2450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWXH63LKPHH' OR c.phone='17779014373' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFWXQQ6SKPHC | 日期=2022-01-16 | 买家=潘鑫 | 手机=15279093922 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFWXQQ6SKPHC' OR c.phone='15279093922' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FFXDKQTA0DYM | 日期=2025-08-09 | 买家=林婧涵 | 手机=18379004986 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXDKQTA0DYM' OR c.phone='18379004986' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXDL24Y0DYL | 日期=2021-12-12 | 买家=余志伟 | 手机=15870977177 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXDL24Y0DYL' OR c.phone='15870977177' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXDL3JA0DYL | 日期=2025-04-09 | 买家=李军平 | 手机=18679091899 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXDL3JA0DYL' OR c.phone='18679091899' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXDLSQ30DYQ | 日期=2024-11-12 | 买家=袁桂英 | 手机=13879003067 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXDLSQ30DYQ' OR c.phone='13879003067' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXDP3020DYQ | 日期=2024-10-29 | 买家=袁倩 | 手机=13879086659 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXDP3020DYQ' OR c.phone='13879086659' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXF2N0H0DYL | 日期=2024-10-12 | 买家=贺威 | 手机=15979880850 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXF2N0H0DYL' OR c.phone='15979880850' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXFHEGH0DYQ | 日期=2025-05-30 | 买家=刘小平 | 手机=17779032200 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXFHEGH0DYQ' OR c.phone='17779032200' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXFHS8H0DYQ | 日期=2023-12-29 | 买家=潘鹏 | 手机=13479000098 | 售价=2150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXFHS8H0DYQ' OR c.phone='13479000098' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXFJK9B0DYQ | 日期=2024-12-18 | 买家=钟建平 | 手机=18279079036 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXFJK9B0DYQ' OR c.phone='18279079036' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXFP21Y0DYL | 日期=2024-11-25 | 买家=张孟洋 | 手机=15262656673 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXFP21Y0DYL' OR c.phone='15262656673' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXFX4680DYL | 日期=2024-03-30 | 买家=林志刚 | 手机=13979098745 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXFX4680DYL' OR c.phone='13979098745' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXG110Y0DYY | 日期=2022-04-06 | 买家=吴军意 | 手机=13755551000 | 售价=4500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXG110Y0DYY' OR c.phone='13755551000' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXG207P0DYQ | 日期=2023-07-05 | 买家=彭文俊 | 手机=18214901775 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXG207P0DYQ' OR c.phone='18214901775' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FFXXP98FKPHJ | 日期=2022-12-16 | 买家=付娟 | 手机=18214902285 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FFXXP98FKPHJ' OR c.phone='18214902285' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FG1FG1T10DYM | 日期=2024-05-29 | 买家=袁欣茹 | 手机=15557382986 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FG1FG1T10DYM' OR c.phone='15557382986' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FG1FM1S80DYL | 日期=2021-06-10 | 买家=黄梓轩 | 手机=18607906565 | 售价=5500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FG1FM1S80DYL' OR c.phone='18607906565' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FG1FM4W50DYQ | 日期=2025-03-05 | 买家=钟子杰 | 手机=15397908739 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FG1FM4W50DYQ' OR c.phone='15397908739' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FG2FM96R0DYQ | 日期=2023-02-21 | 买家=陈卫东 | 手机=18720670375 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FG2FM96R0DYQ' OR c.phone='18720670375' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FG7VH2YFGK | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=7999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FG7VH2YFGK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FHRV9HL63F | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FHRV9HL63F' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FJX0XCVQJJ | 日期=2024-10-26 | 买家=林程远 | 手机=15979876105 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FJX0XCVQJJ' OR c.phone='15979876105' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FJY93WW93K | 日期=2025-08-29 | 买家=长宏调货 | 手机=18679118711 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FJY93WW93K' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1CG1A6N741 | 日期=2020-11-22 | 买家=刘和生 | 手机=15083610997 | 售价=3200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1CG1A6N741' OR c.phone='15083610997' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1CL2VVN705 | 日期=2022-08-19 | 买家=鄢丹 | 手机=18270909297 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1CL2VVN705' OR c.phone='18270909297' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1CN454N745 | 日期=2020-07-25 | 买家=黄燕清 | 手机=13117900759 | 售价=4399.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1CN454N745' OR c.phone='13117900759' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1Q169GG5QT | 日期=2020-12-02 | 买家=戴欣悦 | 手机=15717906413 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1Q169GG5QT' OR c.phone='15717906413' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1QKH3HGRY9 | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1QKH3HGRY9' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1QLWKWGRXV | 日期=2020-01-18 | 买家=钟建军 | 手机=18279042229 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1QLWKWGRXV' OR c.phone='18279042229' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1QMN9VGRY8 | 日期=2021-08-06 | 买家=柳春阳 | 手机=13036286015 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1QMN9VGRY8' OR c.phone='13036286015' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1S48RPG5QY | 日期=2019-07-21 | 买家=袁宇政 | 手机=18179030397 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1S48RPG5QY' OR c.phone='18179030397' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1SLB4HHG86 | 日期=2022-06-20 | 买家=钟志鹏 | 手机=18827904681 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1SLB4HHG86' OR c.phone='18827904681' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1VQM0CJCLF | 日期=2017-11-30 | 买家=郭舒文 | 手机=15707950114 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1VQM0CJCLF' OR c.phone='15707950114' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1VTTJXJCLG | 日期=2020-05-18 | 买家=谢平 | 手机=15180033355 | 售价=2499.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1VTTJXJCLG' OR c.phone='15180033355' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1W4K15JCLF | 日期=2022-03-03 | 买家=胡映晖 | 手机=13879091548 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1W4K15JCLF' OR c.phone='13879091548' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1WT92NJCLF | 日期=2021-05-03 | 买家=李诗华 | 手机=18907900068 | 售价=1450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1WT92NJCLF' OR c.phone='18907900068' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1X45TQJCLF | 日期=2021-06-15 | 买家=卢瑾平 | 手机=18317908231 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1X45TQJCLF' OR c.phone='18317908231' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1X6KXJJCLG | 日期=2020-04-22 | 买家=贾磊 | 手机=18607906921 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1X6KXJJCLG' OR c.phone='18607906921' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1X8BBYJCLF | 日期=2022-09-09 | 买家=林娟 | 手机=13576461221 | 售价=1350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1X8BBYJCLF' OR c.phone='13576461221' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1X8SWNKPJ5 | 日期=2025-06-20 | 买家=范文彬 | 手机=17350481697 | 售价=1100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1X8SWNKPJ5' OR c.phone='17350481697' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XH1MFJCL6 | 日期=2022-09-02 | 买家=张金兰 | 手机=15180061072 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XH1MFJCL6' OR c.phone='15180061072' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XJ0B2KXMG | 日期=2023-05-03 | 买家=钟海兵 | 手机=18279060288 | 售价=1650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XJ0B2KXMG' OR c.phone='18279060288' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XK2QLKPJ2 | 日期=2021-11-02 | 买家=黄力雨 | 手机=18984780302 | 售价=1949.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XK2QLKPJ2' OR c.phone='18984780302' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XMDPUJCLF | 日期=2020-01-05 | 买家=张华波 | 手机=18190040778 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XMDPUJCLF' OR c.phone='18190040778' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XN78SKXKT | 日期=2021-12-29 | 买家=袁家军 | 手机=13237565390 | 售价=1350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XN78SKXKT' OR c.phone='13237565390' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XVG20JCLF | 日期=2025-03-20 | 买家=李志安 | 手机=16607907715 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XVG20JCLF' OR c.phone='16607907715' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1XVXGQJCLF | 日期=2021-03-03 | 买家=林滴滴 | 手机=18279081222 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1XVXGQJCLF' OR c.phone='18279081222' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK1ZM52RN741 | 日期=2022-09-21 | 买家=卢有根 | 手机=15279075070 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK1ZM52RN741' OR c.phone='15279075070' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK2QL973GRXV | 日期=2018-11-10 | 买家=黎飞 | 手机=15007901848 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK2QL973GRXV' OR c.phone='15007901848' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK2RDLHTGRYF | 日期=2016-04-14 | 买家=张玉红 | 手机=15907901398 | 售价=5600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK2RDLHTGRYF' OR c.phone='15907901398' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FK2VV4AZJCLO | 日期=2020-06-25 | 买家=钟敏 | 手机=17779007870 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK2VV4AZJCLO' OR c.phone='17779007870' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FK2X2ARSJCLF | 日期=2021-04-29 | 买家=张伟 | 手机=13755700580 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FK2X2ARSJCLF' OR c.phone='13755700580' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FLX22FV5QQ | 日期=2022-10-02 | 买家=林海根 | 手机=13507908677 | 售价=10000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FLX22FV5QQ' OR c.phone='13507908677' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FN4Q7D9NP3 | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FN4Q7D9NP3' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FNQ266MYPY | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FNQ266MYPY' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FPM9D3Y33C | 日期=2026-02-22 | 买家=林亮 | 手机=13587606413 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FPM9D3Y33C' OR c.phone='13587606413' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FQ5W2MWX97 | 日期=2025-10-28 | 买家=赖鹏 | 手机=13755585289 | 售价=14500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FQ5W2MWX97' OR c.phone='13755585289' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FQH3JR23FL | 日期=2025-02-22 | 买家=胡 | 手机=13692197375 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FQH3JR23FL' OR c.phone='13692197375' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FQTJXKWWKJ | 日期=2026-01-18 | 买家=袁琪 | 手机=15083634349 | 售价=9750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FQTJXKWWKJ' OR c.phone='15083634349' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FRDVT0JAGRYG | 日期=2019-06-16 | 买家=徐 | 手机=18907900320 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FRDVT0JAGRYG' OR c.phone='18907900320' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FRV99VX6TY | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FRV99VX6TY' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FTGY800MGRXH | 日期=2019-04-11 | 买家=胡诗琴 | 手机=15180025799 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FTGY800MGRXH' OR c.phone='15180025799' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FTHSR02VGRX8 | 日期=2020-09-21 | 买家=黄志勇 | 手机=13755565930 | 售价=1200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FTHSR02VGRX8' OR c.phone='13755565930' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FVC2NRYQXN | 日期=2024-11-11 | 买家=谢茵洁 | 手机=17779018696 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FVC2NRYQXN' OR c.phone='17779018696' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FVFZD1YNLYWJ | 日期=2024-09-20 | 买家=汪敬文 | 手机=15979891340 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FVFZD1YNLYWJ' OR c.phone='15979891340' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FVMS300EGRYF | 日期=2016-10-09 | 买家=刘辉 | 手机=13979060103 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FVMS300EGRYF' OR c.phone='13979060103' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FVNXT32DRJ | 日期=2026-01-18 | 买家=周清风 | 手机=18279057910 | 售价=5949.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FVNXT32DRJ' OR c.phone='18279057910' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FVVCF94QHW | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=7999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FVVCF94QHW' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=FWMRW06WKC | 日期=2026-01-21 | 买家=习芳芳 | 手机=13217901029 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FWMRW06WKC' OR c.phone='13217901029' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FX5TJ0VJHG75 | 日期=2023-09-16 | 买家=罗云 | 手机=15350391557 | 售价=30.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FX5TJ0VJHG75' OR c.phone='15350391557' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FX5VF08SHG71 | 日期=2025-06-03 | 买家=钟 | 手机=13879040644 | 售价=600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FX5VF08SHG71' OR c.phone='13879040644' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FXKXL14HH2 | 日期=2024-03-23 | 买家=李红 | 手机=13979000558 | 售价=2900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FXKXL14HH2' OR c.phone='13979000558' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FY163C6Q25/天 | 日期=2025-08-01 | 买家=胡飞扬 | 手机=15180021014 | 售价=7400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FY163C6Q25/天' OR c.phone='15180021014' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=FYNWL13JHG71 | 日期=2022-08-15 | 买家=曾 | 手机=15979870066 | 售价=800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='FYNWL13JHG71' OR c.phone='15979870066' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NC2CPKN745 | 日期=2024-02-01 | 买家=童恩 | 手机=18397906298 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NC2CPKN745' OR c.phone='18397906298' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G0NCD540N742 | 日期=2024-04-30 | 买家=郭 | 手机=18907908554 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NCD540N742' OR c.phone='18907908554' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NCJ2NEN745 | 日期=2024-05-09 | 买家=钟晶 | 手机=13755551069 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NCJ2NEN745' OR c.phone='13755551069' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0ND6H40N746 | 日期=2022-02-28 | 买家=严强 | 手机=13607900486 | 售价=2850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0ND6H40N746' OR c.phone='13607900486' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G0NDVRY0D5L | 日期=2023-12-19 | 买家=李桂根 | 手机=15279980921 | 售价=3400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NDVRY0D5L' OR c.phone='15279980921' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NVX8RVJCLG | 日期=2022-08-31 | 买家=蓝思鹏 | 手机=18778220835 | 售价=1300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NVX8RVJCLG' OR c.phone='18778220835' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NY43EMKXM5 | 日期=2021-05-25 | 买家=袁楚彤 | 手机=13677900479 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NY43EMKXM5' OR c.phone='13677900479' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NYN29CKPG3 | 日期=2025-07-19 | 买家=孙竽宣 | 手机=18779016625 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NYN29CKPG3' OR c.phone='18779016625' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NYP4HXKPGN | 日期=2019-07-06 | 买家=曾罗红 | 手机=13507004145 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NYP4HXKPGN' OR c.phone='13507004145' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NZRFXCN741 | 日期=2023-08-30 | 买家=刘轩宇 | 手机=19807041334 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NZRFXCN741' OR c.phone='19807041334' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0NZT2FQN742 | 日期=2021-11-12 | 买家=钟钰杰 | 手机=13367907338 | 售价=2900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0NZT2FQN742' OR c.phone='13367907338' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0PVQ5Q2JCL7 | 日期=2021-11-13 | 买家=夏诗雨 | 手机=15807901197 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0PVQ5Q2JCL7' OR c.phone='15807901197' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0PW18Z6JCLF | 日期=2021-04-11 | 买家=黄朝 | 手机=18607901562 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0PW18Z6JCLF' OR c.phone='18607901562' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0PW3RX2JCLF | 日期=2018-04-21 | 买家=陈秀 | 手机=18007900822 | 售价=7650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0PW3RX2JCLF' OR c.phone='18007900822' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G0PXL2BUKXM7 | 日期=2022-04-03 | 买家=袁安 | 手机=18879018566 | 售价=1750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G0PXL2BUKXM7' OR c.phone='18879018566' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G392T72FYD | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=7999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G392T72FYD' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G3DK6L7J16 | 日期=2024-10-22 | 买家=黄刘敏 | 手机=15605883283 | 售价=4700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G3DK6L7J16' OR c.phone='15605883283' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G3M6JYHTH6 | 日期=2025-11-08 | 买家=林滴滴 | 手机=18279081222 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G3M6JYHTH6' OR c.phone='18279081222' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G4H23GCY9D | 日期=2024-08-08 | 买家=李慧文 | 手机=17379069336 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G4H23GCY9D' OR c.phone='17379069336' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G4H23GCY9D/1700 | 日期=2025-07-22 | 买家=朱瑞奇 | 手机=17673070035 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G4H23GCY9D/1700' OR c.phone='17673070035' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G5G4TP299G | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G5G4TP299G' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G5G9K71170 | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G5G9K71170' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G5Q94F3FKP | 日期=2025-01-30 | 买家=李昌州 | 手机=17779083959 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G5Q94F3FKP' OR c.phone='17779083959' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G5Q9MWQTXD | 日期=2026-01-30 | 买家=周秦 | 手机=13755552305 | 售价=7999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G5Q9MWQTXD' OR c.phone='13755552305' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G60Y39XNNF | 日期=2024-11-20 | 买家=钟家鸿 | 手机=13163924497 | 售价=4500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G60Y39XNNF' OR c.phone='13163924497' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G67T1717JK | 日期=2025-11-06 | 买家=李芳 | 手机=15779590936 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G67T1717JK' OR c.phone='15779590936' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G6TXMQYY44 | 日期=2026-04-13 | 买家=熊志康 | 手机=19194989557 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6TXMQYY44' OR c.phone='19194989557' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6TYN7S7KPJ4 | 日期=2019-11-02 | 买家=袁水芬 | 手机=13367908078 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6TYN7S7KPJ4' OR c.phone='13367908078' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6TYPE6XKPJ5 | 日期=2023-06-28 | 买家=黄祖媛 | 手机=17379066321 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6TYPE6XKPJ5' OR c.phone='17379066321' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6TYX5QMKPHJ | 日期=2023-04-25 | 买家=郭建辉 | 手机=18870276335 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6TYX5QMKPHJ' OR c.phone='18870276335' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6TZL5YHN70Y | 日期=2024-06-11 | 买家=袁轩铭 | 手机=15970254254 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6TZL5YHN70Y' OR c.phone='15970254254' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6VY3AE2KPJ3 | 日期=2025-12-06 | 买家=刘晓军 | 手机=18979082007 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6VY3AE2KPJ3' OR c.phone='18979082007' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6WCD9HV9V | 日期=2025-01-22 | 买家=钟炳云 | 手机=13538079268 | 售价=5000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6WCD9HV9V' OR c.phone='13538079268' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G6WVTP3HJCLG | 日期=2021-11-13 | 买家=严海靓 | 手机=18296200717 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G6WVTP3HJCLG' OR c.phone='18296200717' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=G79QC7KHYH | 日期=2025-07-20 | 买家=钟师 | 手机=18679098901 | 售价=1000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G79QC7KHYH' OR c.phone='18679098901' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=G7YFLQRXKN | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='G7YFLQRXKN' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GCQTPFCFQ4 | 日期=2025-09-26 | 买家=罗蕴涵 | 手机=13879044449 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GCQTPFCFQ4' OR c.phone='13879044449' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GDGY71TWJCL6 | 日期=2019-05-31 | 买家=黄 星 | 手机=13367903310 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GDGY71TWJCL6' OR c.phone='13367903310' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GDGYV01JJCLY | 日期=2019-09-08 | 买家=敖建平 | 手机=13979080533 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GDGYV01JJCLY' OR c.phone='13979080533' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GDJ2JJ7M99 | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GDJ2JJ7M99' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GF7M9159X9 | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=10999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GF7M9159X9' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GJX01Q643D | 日期=2024-11-14 | 买家=刘瑶英 | 手机=18379019632 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GJX01Q643D' OR c.phone='18379019632' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GP129CR4FV | 日期=2025-09-17 | 买家=黄艳红 | 手机=13879060716 | 售价=2420.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GP129CR4FV' OR c.phone='13879060716' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GPX6VFQ6FC | 日期=2022-12-31 | 买家=李心玉 | 手机=15279046301 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GPX6VFQ6FC' OR c.phone='15279046301' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GPYQ9FK3GX | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GPYQ9FK3GX' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GQ5ZN08MKXM5 | 日期=2024-02-15 | 买家=詹雪微 | 手机=18279086120 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GQ5ZN08MKXM5' OR c.phone='18279086120' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GQT2VHW7KR | 日期=2025-04-12 | 买家=刘细根 | 手机=13320005025 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GQT2VHW7KR' OR c.phone='13320005025' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GQXL20KC4W | 日期=2025-06-16 | 买家=钟泽睿 | 手机=13186800571 | 售价=4650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GQXL20KC4W' OR c.phone='13186800571' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GR6CR0C0KPHJ | 日期=2022-06-14 | 买家=钟琴 | 手机=19136947220 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GR6CR0C0KPHJ' OR c.phone='19136947220' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GRQZ2XX6LX2Y | 日期=2019-08-06 | 买家=罗卿 | 手机=13979001111 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GRQZ2XX6LX2Y' OR c.phone='13979001111' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GTK9XQ02GY | 日期=2026-01-17 | 买家=陈季红 | 手机=13707904389 | 售价=7999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GTK9XQ02GY' OR c.phone='13707904389' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GW1J7J27ND | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GW1J7J27ND' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GWV69C3606 | 日期=2025-09-06 | 买家=陈阳 | 手机=19174366232 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GWV69C3606' OR c.phone='19174366232' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GX6C9PXTLKKT | 日期=2020-06-25 | 买家=李宇轩 | 手机=13755551170 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GX6C9PXTLKKT' OR c.phone='13755551170' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GXJZG02BN72T | 日期=2023-04-08 | 买家=陈玉轩 | 手机=15083618051 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GXJZG02BN72T' OR c.phone='15083618051' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GXQZ820WJCLF | 日期=2022-10-14 | 买家=林金豪 | 手机=18379007505 | 售价=950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GXQZ820WJCLF' OR c.phone='18379007505' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=GY0KC2H4CH | 日期=2024-09-21 | 买家=钟鑫 | 手机=17779072110 | 售价=6800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GY0KC2H4CH' OR c.phone='17779072110' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GYJGP4GWKK | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=5650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GYJGP4GWKK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=GYXY9CR2R0 | 日期=2026-01-16 | 买家=长宏调货 | 手机=18679118711 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='GYXY9CR2R0' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=H00XVP7V9V | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H00XVP7V9V' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=H067J3VGPV | 日期=2025-01-27 | 买家=李香根 | 手机=13979094800 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H067J3VGPV' OR c.phone='13979094800' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=H1JW029971 | 日期=2025-11-10 | 买家=钟丽琳 | 手机=18079073821 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H1JW029971' OR c.phone='18079073821' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=H25PH3G6P0 | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H25PH3G6P0' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=H4C95JKY4Y | 日期=2024-07-10 | 买家=李小根 | 手机=19815173912 | 售价=4800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H4C95JKY4Y' OR c.phone='19815173912' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=H52XP44HPX | 日期=2024-09-17 | 买家=张伟 | 手机=18279050779 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H52XP44HPX' OR c.phone='18279050779' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=H7T7906PYG | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H7T7906PYG' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=H9HQK44KLH | 日期=2025-01-09 | 买家=周梦婷 | 手机=18779000242 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H9HQK44KLH' OR c.phone='18779000242' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=H9QQJH2JCJ | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='H9QQJH2JCJ' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HCY7V50CHK | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HCY7V50CHK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HDY2C00C73 | 日期=2024-01-17 | 买家=杨志文 | 手机=15876548841 | 售价=3550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HDY2C00C73' OR c.phone='15876548841' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HFKYQMF3XK | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=9950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HFKYQMF3XK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HFKYQMF3XK | 日期=2025-10-31 | 买家=孙瑶 | 手机=15870095403 | 售价=9700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HFKYQMF3XK' OR c.phone='15870095403' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HG2792H7HJ | 日期=2025-11-23 | 买家=傅建军 | 手机=15279086161 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HG2792H7HJ' OR c.phone='15279086161' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HGY9FWW50Y | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HGY9FWW50Y' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HH5H6TT4FQ | 日期=2025-10-30 | 买家=陈国仁 | 手机=13979069699 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HH5H6TT4FQ' OR c.phone='13979069699' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HJ65K2MQX1 | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HJ65K2MQX1' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HJ7TDJ09XQ | 日期=2026-03-28 | 买家=聂芬 | 手机=18296543836 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HJ7TDJ09XQ' OR c.phone='18296543836' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HJFJD7RMJKM9 | 日期=2023-01-03 | 买家=黄静 | 手机=13979000907 | 售价=900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HJFJD7RMJKM9' OR c.phone='13979000907' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HK14RCFK3Y | 日期=2026-01-19 | 买家=余亮 | 手机=13767877717 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HK14RCFK3Y' OR c.phone='13767877717' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HK755QG06G | 日期=2025-05-09 | 买家=梁艳燕 | 手机=13617902241 | 售价=8000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HK755QG06G' OR c.phone='13617902241' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HL6GK0PQ30 | 日期=2025-11-06 | 买家=长宏调货 | 手机=1 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HL6GK0PQ30' OR c.phone='1' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HQ5QD29MDP | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HQ5QD29MDP' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HT7GPYYTW2 | 日期=2024-10-07 | 买家=张玉玲 | 手机=13979071505 | 售价=2800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HT7GPYYTW2' OR c.phone='13979071505' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HX7MCW99FX | 日期=2025-10-07 | 买家=钟化 | 手机=13297649368 | 售价=2400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HX7MCW99FX' OR c.phone='13297649368' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HXJNR35V43 | 日期=2025-07-12 | 买家=汤军 | 手机=13507902270 | 售价=3900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HXJNR35V43' OR c.phone='13507902270' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=HXNL4H63F3 | 日期=2025-11-05 | 买家=象经理 | 手机=15270956789 | 售价=9750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HXNL4H63F3' OR c.phone='15270956789' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=HY3KW3NKG1 | 日期=2025-02-21 | 买家=熊梓琪 | 手机=18179026631 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='HY3KW3NKG1' OR c.phone='18179026631' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=J16LKP20NK | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J16LKP20NK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=J3X74JKGMC | 日期=2024-11-07 | 买家=吴静 | 手机=18397909551 | 售价=3900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J3X74JKGMC' OR c.phone='18397909551' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=J5TJY2HG40 | 日期=2022-10-17 | 买家=钟奇 | 手机=13217901392 | 售价=5500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J5TJY2HG40' OR c.phone='13217901392' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=J91XDJ7JQY | 日期=2023-09-18 | 买家=敖英 | 手机=13677908680 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J91XDJ7JQY' OR c.phone='13677908680' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=J92NXMJ411 | 日期=2025-01-16 | 买家=吴美琪 | 手机=15779584221 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J92NXMJ411' OR c.phone='15779584221' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=J9LJ92WJ0P | 日期=2026-01-07 | 买家=聂芬 | 手机=18296543836 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='J9LJ92WJ0P' OR c.phone='18296543836' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JD91YCVQ2F | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JD91YCVQ2F' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JFJYVF7WTG | 日期=2026-03-08 | 买家=伍锡超 | 手机=18579100383 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JFJYVF7WTG' OR c.phone='18579100383' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JFT9F0HN69 | 日期=2025-01-23 | 买家=钟红兰 | 手机=18279090610 | 售价=1700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JFT9F0HN69' OR c.phone='18279090610' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JHC49PRYTH | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JHC49PRYTH' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JHJ75LX7GM | 日期=2023-08-12 | 买家=邹润生 | 手机=19970107599 | 售价=8500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JHJ75LX7GM' OR c.phone='19970107599' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JJ244RGWY6 | 日期=2026-01-27 | 买家=温漠强 | 手机=13732922666 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JJ244RGWY6' OR c.phone='13732922666' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JJHW6T56CC | 日期=2025-10-29 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JJHW6T56CC' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JJWH6MPXT0 | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JJWH6MPXT0' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JKOW37VF26 | 日期=2026-01-07 | 买家=聂芬 | 手机=18296543836 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JKOW37VF26' OR c.phone='18296543836' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JN14LGWGJM | 日期=2023-01-15 | 买家=施嘉敏 | 手机=15697902787 | 售价=9600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JN14LGWGJM' OR c.phone='15697902787' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JN4CM0XMGD | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JN4CM0XMGD' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JNXVVGKKW7 | 日期=2021-10-04 | 买家=郭郭 | 手机=18707009991 | 售价=9500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JNXVVGKKW7' OR c.phone='18707009991' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JNYJXMWNR9 | 日期=2024-02-01 | 买家=林聪 | 手机=18079521050 | 售价=3380.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JNYJXMWNR9' OR c.phone='18079521050' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JP6JLKXCWG | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JP6JLKXCWG' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JP7HG2H7WP | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JP7HG2H7WP' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JRQ5HCWYDQ | 日期=2026-01-22 | 买家=鄢礼平 | 手机=15607906663 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JRQ5HCWYDQ' OR c.phone='15607906663' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JT26KPN7YN | 日期=2025-08-24 | 买家=李远龙 | 手机=17373520272 | 售价=2450.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JT26KPN7YN' OR c.phone='17373520272' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JTJNPW07QX | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JTJNPW07QX' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JW4F127N79 | 日期=2026-01-19 | 买家=余亮 | 手机=13767877717 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JW4F127N79' OR c.phone='13767877717' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JXT914VV2W | 日期=2025-06-10 | 买家=钟水根 | 手机=15870091010 | 售价=2850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JXT914VV2W' OR c.phone='15870091010' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=JXYC7TFHPW | 日期=2024-02-07 | 买家=袁凯乐 | 手机=18870285216 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JXYC7TFHPW' OR c.phone='18870285216' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=JYDHQQC6CP | 日期=2025-12-07 | 买家=长宏调货 | 手机=18679112185 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='JYDHQQC6CP' OR c.phone='18679112185' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=K0PXJ6F9QR | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K0PXJ6F9QR' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K2CVX444FN | 日期=2023-08-09 | 买家=胡晨萱 | 手机=15279050903 | 售价=6900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K2CVX444FN' OR c.phone='15279050903' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=K33HYPDXFK | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=8600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K33HYPDXFK' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K6F4FH4H2W | 日期=2025-06-15 | 买家=林传珍 | 手机=15180031364 | 售价=3800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K6F4FH4H2W' OR c.phone='15180031364' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K6NWRVPM4V | 日期=2024-08-09 | 买家=张颖 | 手机=15007901603 | 售价=6600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K6NWRVPM4V' OR c.phone='15007901603' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K6WXQLXV3Q | 日期=2025-01-11 | 买家=林海燕 | 手机=13576460562 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K6WXQLXV3Q' OR c.phone='13576460562' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K73JN9K4Y6 | 日期=2025-03-05 | 买家=杨智敏 | 手机=15070131432 | 售价=4400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K73JN9K4Y6' OR c.phone='15070131432' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K7Y6MHF7LC | 日期=2026-01-15 | 买家=胡斌 | 手机=18979000986 | 售价=5899.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K7Y6MHF7LC' OR c.phone='18979000986' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K992L59VKP | 日期=2025-04-30 | 买家=熊梓琪 | 手机=13507907736 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K992L59VKP' OR c.phone='13507907736' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=K9DJ1XK436 | 日期=2026-01-04 | 买家=钟安康 | 手机=18770780970 | 售价=8820.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K9DJ1XK436' OR c.phone='18770780970' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=K9HW71N60N | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K9HW71N60N' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=K9W54M4PTJ | 日期=2024-05-10 | 买家=黄苏苏 | 手机=15083639838 | 售价=6950.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='K9W54M4PTJ' OR c.phone='15083639838' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KC2GWLWHX4 | 日期=2026-02-09 | 买家=长宏调货 | 手机=18679112185 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KC2GWLWHX4' OR c.phone='18679112185' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KCQ1YGFQG3 | 日期=2025-01-02 | 买家=黄文凯 | 手机=18179025099 | 售价=4000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KCQ1YGFQG3' OR c.phone='18179025099' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KH5Q1KFVMX | 日期=2025-11-02 | 买家=罗雨欣 | 手机=17707901793 | 售价=4200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KH5Q1KFVMX' OR c.phone='17707901793' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KHW6K3YXYH | 日期=2025-10-24 | 买家=新凯调货 | 手机=13030559899 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KHW6K3YXYH' OR c.phone='13030559899' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KKHCWXVGCF | 日期=2022-04-05 | 买家=钱坤 | 手机=13755590303 | 售价=5750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KKHCWXVGCF' OR c.phone='13755590303' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KP249C9C71 | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KP249C9C71' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KP61NHFDQM | 日期=2025-11-27 | 买家=钟涛 | 手机=13258329039 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KP61NHFDQM' OR c.phone='13258329039' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KPFJ6H6KLQ | 日期=2024-02-02 | 买家=钟小军 | 手机=13807908388 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KPFJ6H6KLQ' OR c.phone='13807908388' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KQ4WJWVJMV | 日期=2022-12-08 | 买家=淘宝用户 | 手机=18563709321 | 售价=7150.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KQ4WJWVJMV' OR c.phone='18563709321' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=KQNW34WWK0 | 日期=2024-12-16 | 买家=钟志军 | 手机=15180067536 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KQNW34WWK0' OR c.phone='15180067536' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KQWW0M421R | 日期=2026-01-16 | 买家=长宏调货 | 手机=18679118711 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KQWW0M421R' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KX00HC46GM | 日期=2026-02-06 | 买家=肖金良 | 手机=18679072888 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KX00HC46GM' OR c.phone='18679072888' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=KY7344F77M | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='KY7344F77M' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=L07K3G4G20 | 日期=2026-02-21 | 买家=钟建平 | 手机=17379056835 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L07K3G4G20' OR c.phone='17379056835' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=L23Y0Q9P42 | 日期=2025-09-24 | 买家=长宏调货 | 手机=18679118711 | 售价=11300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L23Y0Q9P42' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=L2JJ4Q2L2V | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L2JJ4Q2L2V' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=L4D959FG2X | 日期=2025-09-05 | 买家=程 | 手机=13879010148 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L4D959FG2X' OR c.phone='13879010148' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=L590R2R414 | 日期=2026-04-24 | 买家=汤艳华 | 手机=18607992266 | 售价=1.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L590R2R414' OR c.phone='18607992266' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=L5F9W4PV3F | 日期=2024-12-04 | 买家=李莎 | 手机=13879070471 | 售价=3650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L5F9W4PV3F' OR c.phone='13879070471' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=L60TV3TXD1 | 日期=2025-07-20 | 买家=杨紫玲 | 手机=17379017581 | 售价=1400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L60TV3TXD1' OR c.phone='17379017581' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=L9D4V9DXRG | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='L9D4V9DXRG' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LDH7XX9TH9 | 日期=2024-02-18 | 买家=杜海峰 | 手机=13576471636 | 售价=2900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LDH7XX9TH9' OR c.phone='13576471636' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=LGK4QR61YD | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=12999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LGK4QR61YD' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LH7MHYHQW2 | 日期=2025-02-02 | 买家=钟鑫博 | 手机=13879018789 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LH7MHYHQW2' OR c.phone='13879018789' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=LNXT4MP2RD | 日期=2026-01-29 | 买家=王文滔 | 手机=18879061660 | 售价=6100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LNXT4MP2RD' OR c.phone='18879061660' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LQPFHGX993/600+屏幕110+电池70 | 日期=2025-07-14 | 买家=林晓琪 | 手机=13423304749 | 售价=1500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LQPFHGX993/600+屏幕110+电池70' OR c.phone='13423304749' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LRFX490DKJ | 日期=2025-03-04 | 买家=赵 | 手机=18979001521 | 售价=6000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LRFX490DKJ' OR c.phone='18979001521' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LV4P12YYP2 | 日期=2022-06-16 | 买家=兰桃花 | 手机=18797907776 | 售价=7800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LV4P12YYP2' OR c.phone='18797907776' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LWGJD4RW3N | 日期=2025-03-22 | 买家=李志贤 | 手机=13979097742 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LWGJD4RW3N' OR c.phone='13979097742' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=LX907Q2LQV | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LX907Q2LQV' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LYH02M12QK | 日期=2025-03-05 | 买家=钟 | 手机=18879071213 | 售价=6750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LYH02M12QK' OR c.phone='18879071213' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=LYH02M12QK/6000 | 日期=2025-03-20 | 买家=李江红 | 手机=19533558036 | 售价=6550.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='LYH02M12QK/6000' OR c.phone='19533558036' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M0GDGQN3WK | 日期=2024-09-18 | 买家=何静 | 手机=19107076663 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M0GDGQN3WK' OR c.phone='19107076663' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M19N3T72MM | 日期=2026-01-22 | 买家=长宏调货 | 手机=18679118711 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M19N3T72MM' OR c.phone='18679118711' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M2C7X0QKHR | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=10999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M2C7X0QKHR' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M2KDMQWGVP | 日期=2025-03-05 | 买家=晏光辉 | 手机=18079066880 | 售价=3700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M2KDMQWGVP' OR c.phone='18079066880' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M2WFDY0QVL | 日期=2024-11-25 | 买家=卢佳成 | 手机=18979086639 | 售价=2500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M2WFDY0QVL' OR c.phone='18979086639' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M3KMG93QY3 | 日期=2025-02-12 | 买家=张小昆 | 手机=13617908297 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M3KMG93QY3' OR c.phone='13617908297' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M3P2DC71G6 | 日期=2025-05-01 | 买家=李海雪 | 手机=18507901899 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M3P2DC71G6' OR c.phone='18507901899' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M445C9X66D | 日期=2026-02-03 | 买家=黄建军 | 手机=18079086644 | 售价=5630.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M445C9X66D' OR c.phone='18079086644' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M4CW50YG4Q | 日期=2026-01-19 | 买家=余亮 | 手机=13767877717 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M4CW50YG4Q' OR c.phone='13767877717' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M4DDXC6HJN | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M4DDXC6HJN' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M4NCQ7KWV1 | 日期=2026-02-09 | 买家=长宏调货 | 手机=18679112185 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M4NCQ7KWV1' OR c.phone='18679112185' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M5H399K2CG | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=14400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M5H399K2CG' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M6KJTCJV9M | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M6KJTCJV9M' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M7QQHX5G7Q | 日期=2025-12-26 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M7QQHX5G7Q' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M7XH5QKD07 | 日期=2026-01-29 | 买家=黄斌 | 手机=16607906616 | 售价=8500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M7XH5QKD07' OR c.phone='16607906616' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=M94CJGF4GTQ | 日期=2025-12-25 | 买家=钟雨菲 | 手机=13007207173 | 售价=10600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M94CJGF4GTQ' OR c.phone='13007207173' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=M94P966TC2 | 日期=2023-03-03 | 买家=郭兵 | 手机=18279097821 | 售价=5400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='M94P966TC2' OR c.phone='18279097821' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=MCQ6PP2KK2 | 日期=2025-09-07 | 买家=琦琦 | 手机=15180011117 | 售价=3500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MCQ6PP2KK2' OR c.phone='15180011117' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=MCYWC25CQT | 日期=2024-09-28 | 买家=陈志刚 | 手机=15180000366 | 售价=5000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MCYWC25CQT' OR c.phone='15180000366' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MK91N7WTQN | 日期=2025-12-15 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MK91N7WTQN' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MKXQWH2GN6 | 日期=2025-12-20 | 买家=朱声财 | 手机=13755708345 | 售价=8999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MKXQWH2GN6' OR c.phone='13755708345' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=ML46RD6WR7 | 日期=2025-08-18 | 买家=黄梅兰 | 手机=15979890298 | 售价=4100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='ML46RD6WR7' OR c.phone='15979890298' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=ML9QW90F0J | 日期=2025-10-27 | 买家=陈国仁 | 手机=13907906089 | 售价=8850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='ML9QW90F0J' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MN4J3Y92VN | 日期=2025-11-09 | 买家=徐欢 | 手机=13979002364 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MN4J3Y92VN' OR c.phone='13979002364' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=MPN7X2Q3HJ | 日期=2025-08-21 | 买家=陈蓄妍 | 手机=13361703983 | 售价=4800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MPN7X2Q3HJ' OR c.phone='13361703983' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MT7LR2W4YT | 日期=2025-09-30 | 买家=扁担科技 | 手机=13879009652 | 售价=10850.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MT7LR2W4YT' OR c.phone='13879009652' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MTFYKQJQP9 | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=12999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MTFYKQJQP9' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MV69QFX49V | 日期=2026-01-23 | 买家=新凯罗乐乐 | 手机=19100238555 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MV69QFX49V' OR c.phone='19100238555' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MVDJX9HC4C | 日期=2025-11-25 | 买家=陈国仁 | 手机=13907906089 | 售价=11999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MVDJX9HC4C' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MVV56NXMYW | 日期=2026-01-05 | 买家=陈国仁 | 手机=13907906089 | 售价=9999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MVV56NXMYW' OR c.phone='13907906089' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=MXHL247F7T | 日期=2025-10-19 | 买家=钟红梅 | 手机=13979040006 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MXHL247F7T' OR c.phone='13979040006' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=MXV65VW0TW | 日期=2024-11-30 | 买家=严春艳 | 手机=15070130209 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MXV65VW0TW' OR c.phone='15070130209' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=MY0960M2YC | 日期=2025-11-21 | 买家=李小桂 | 手机=15279015181 | 售价=5999.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='MY0960M2YC' OR c.phone='15279015181' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=N6PL6Y46V6 | 日期=2025-06-13 | 买家=梁欣 | 手机=15070121065 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='N6PL6Y46V6' OR c.phone='15070121065' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=NG24KTD3F7 | 日期=2023-03-20 | 买家=何先生 | 手机=15180000379 | 售价=2050.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='NG24KTD3F7' OR c.phone='15180000379' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=NP79YR9LQV | 日期=2025-12-28 | 买家=张高锋 | 手机=18879030588 | 售价=1800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='NP79YR9LQV' OR c.phone='18879030588' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=NR6J7WD7HK | 日期=2024-03-25 | 买家=张景程 | 手机=15797615019 | 售价=4800.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='NR6J7WD7HK' OR c.phone='15797615019' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=NYVHG4GFHC | 日期=2025-09-19 | 买家=黄梅兰 | 手机=15979890298 | 售价=2300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='NYVHG4GFHC' OR c.phone='15979890298' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=P3HQJWL43W | 日期=2021-11-30 | 买家=黄伟 | 手机=18979078732 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='P3HQJWL43W' OR c.phone='18979078732' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=P6RY4J064Q | 日期=2024-10-11 | 买家=夏侯赟 | 手机=13397904453 | 售价=3300.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='P6RY4J064Q' OR c.phone='13397904453' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=PD62D1966V | 日期=2024-12-15 | 买家=梁露 | 手机=13879042834 | 售价=2718.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='PD62D1966V' OR c.phone='13879042834' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=PLWQV69Y3X | 日期=2025-03-11 | 买家=钟疏桐 | 手机=15279056884 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='PLWQV69Y3X' OR c.phone='15279056884' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=Q0FXKR99N0 | 日期=2023-09-29 | 买家=黄 | 手机=13316891848 | 售价=3350.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='Q0FXKR99N0' OR c.phone='13316891848' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=Q9K9DV6JQ4 | 日期=2025-06-24 | 买家=傅玉龙 | 手机=17262098040 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='Q9K9DV6JQ4' OR c.phone='17262098040' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=QGT9VPTYTH | 日期=2025-10-14 | 买家=钟 | 手机=13008871234 | 售价=3400.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='QGT9VPTYTH' OR c.phone='13008871234' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=QW6R2P45JC | 日期=2024-03-13 | 买家=林小兰 | 手机=18827908117 | 售价=3388.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='QW6R2P45JC' OR c.phone='18827908117' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=QWNXT622WC | 日期=2025-11-19 | 买家=李宇平 | 手机=18279082231 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='QWNXT622WC' OR c.phone='18279082231' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=RD7LD7YXXY | 日期=2022-10-17 | 买家=单坡 | 手机=13755714314 | 售价=5100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='RD7LD7YXXY' OR c.phone='13755714314' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=SF9FYR20ULMPL | 日期=2019-07-18 | 买家=李欣阳 | 手机=13755581622 | 售价=0.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='SF9FYR20ULMPL' OR c.phone='13755581622' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=T4X6RD9YPQ | 日期=2022-10-27 | 买家=徐娟 | 手机=13755710908 | 售价=4100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='T4X6RD9YPQ' OR c.phone='13755710908' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=TXY22KJQPH | 日期=2024-01-03 | 买家=廖丹 | 手机=19815175137 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='TXY22KJQPH' OR c.phone='19815175137' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=V7RRLC7RKQ | 日期=2024-12-23 | 买家=程刚议 | 手机=18379020013 | 售价=2600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='V7RRLC7RKQ' OR c.phone='18379020013' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=V9V6V4KHKV | 日期=2025-11-12 | 买家=刘玉斌 | 手机=13870505239 | 售价=1900.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='V9V6V4KHKV' OR c.phone='13870505239' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=VD4M4J6KW4 | 日期=2024-04-05 | 买家=袁 | 手机=17521725420 | 售价=8750.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='VD4M4J6KW4' OR c.phone='17521725420' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=VF9W2Q60FF | 日期=2024-07-02 | 买家=黄丽 | 手机=13197843763 | 售价=2700.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='VF9W2Q60FF' OR c.phone='13197843763' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=VG49X4Q2RP | 日期=2024-08-26 | 买家=邹爱清 | 手机=18397806732 | 售价=2650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='VG49X4Q2RP' OR c.phone='18397806732' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=W2NW5HH62G | 日期=2025-08-08 | 买家=黄聪 | 手机=18607900505 | 售价=2100.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='W2NW5HH62G' OR c.phone='18607900505' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=W6M9WM3PG7 | 日期=2025-01-15 | 买家=黄晨欣 | 手机=13426674513 | 售价=2460.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='W6M9WM3PG7' OR c.phone='13426674513' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=W6N2K6TY0Q | 日期=2025-05-08 | 买家=黄佳晨 | 手机=18279061679 | 售价=2200.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='W6N2K6TY0Q' OR c.phone='18279061679' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=X1D6THWX7K | 日期=2025-09-11 | 买家=黄 | 手机=18870280302 | 售价=2399.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='X1D6THWX7K' OR c.phone='18870280302' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=X322494GWJ | 日期=2024-07-02 | 买家=郭燕 | 手机=18879020433 | 售价=2650.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='X322494GWJ' OR c.phone='18879020433' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=X70KKG26RJ | 日期=2024-08-08 | 买家=金城优品 | 手机=13879040323 | 售价=4500.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='X70KKG26RJ' OR c.phone='13879040323' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=X799TDYV06 | 日期=2025-08-06 | 买家=黄传林 | 手机=15221012847 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='X799TDYV06' OR c.phone='15221012847' ORDER BY s.sale_time,s.id;

-- 独立事件候选 | SN=XJMQ9WQVTR | 日期=2024-01-25 | 买家=肖翔 | 手机=19807966668 | 售价=3000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='XJMQ9WQVTR' OR c.phone='19807966668' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=Y85ARCM00A00 | 日期=2018-04-03 | 买家=孙鹏 | 手机=17607900469 | 售价=1600.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='Y85ARCM00A00' OR c.phone='17607900469' ORDER BY s.sale_time,s.id;

-- 缺失销售候选 | SN=YD6CH0JR92 | 日期=2025-07-01 | 买家=朱丹 | 手机=1837803096 | 售价=2000.00
SELECT s.id sale_id,s.phone_id device_id,p.serial_number,s.sale_time,s.sale_price,c.name,c.phone FROM phones p LEFT JOIN sales s ON s.phone_id=p.id LEFT JOIN customers c ON c.id=s.customer_id WHERE p.serial_number='YD6CH0JR92' OR c.phone='1837803096' ORDER BY s.sale_time,s.id;
