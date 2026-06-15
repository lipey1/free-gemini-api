const GEMINI_URL_TEMPLATE =
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260525.09_p0&f.sid=7107405850776780598&hl=pt-BR&_reqid={REQID}&rt=c";

const GEMINI_BODY_TEMPLATE =
  "f.req=%5Bnull%2C%22%5B%5B%5C%22oii%5C%22%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2C0%5D%2C%5B%5C%22pt-BR%5C%22%5D%2C%5B%5C%22%5C%22%2C%5C%22%5C%22%2C%5C%22%5C%22%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5C%22%5C%22%5D%2C%5C%22!BQalBmLNAAaRynuKscpCUp302eU-nM87AEABEArZ1DcgbV961qrdcl1Aea4_Dnc2PCVfckx-hscI5a1g-7oM1lYWpaIrtEOWFUktw0uT-BMZ9_pEnTK4Mb7RAgAAALNSAAAABmgBB34AREljQ0sAls9Ng1cSRTfdXCZ2GC_sii6shjUJhPl9e3oG4buW4QRxh0_UJl7s8CAOGz3cHtszPrldl3tQZdrzqasDWPQimQaFKX1KWSxK8SAi-Gp65pQwxMk7I-z-69m_3P8-jF-P6yJFw5Pw7gUHjSD1wQR2f5YESM3ZxxVdFyp1772vLiWY5fe7XG5nIYFMp8iBRejaYQwmzr1RFKdD-uO8ntX4YYKcHgyuddX_anQiWRPJu5j2Sovj7CLaDUS5vu35-CmwWAGNx-KZ0_b65ptJD8xDdmX4zKk4TOsD8AuplD510zbATt3SIYnF43uBG8PiMyElGSKfMP6H3a7IfGtdrTn9rJSXflAmff0HIRh6oH8VdR9LMV7KUh9l3Y4ljgyO4EDWWr-Vv-OdfZJcn1FxwIiEk-TJzLrhDfqi2xBauUiZqnIg17-kmKJD2s5g5T75gY4Ad7PFrt_7S-pL5dYq_l0n2MbHOZ6UVZ33sgwn8eZPjC8Z3oYMiytISQYzDI9cGcbgNZddxNRoUrtUupD2b9JblnyPn7eYmC9dz0ZaZ7FNPuZeT3mMFxZ8gf6hqFx1NktRlcdJ8IlD1yekb0su00oUdDLUkloBL1A0oL0D08zBAwajX7RtHuQE_QuXfLM7fCDDJmFNFxthLEWxQi0sYt0Tog1KB7I8uzO2BcmbjSzPgP6lLonOlKB26_VZ0XA28XPbIpOp_LVyMe-o-T1UXpHm7kNX0lhXJVgl2IEG4olBuJJ1x6XH2dxjCI4hGOfeIjoQh10FiLwSAqmvuvhJ_RxwKYpb_2csTh6cB58nhanVj4yrMdbnKlOoZ_G80dDzk8j2-K1Lj3S1hbpEBU0DSm6_gdJ7d9Css6FnkqAZ0_3lRYWfeFz1Qmkq4khoymVZLJ8UOb1-5dGm5irByTJZQ6ufg0dbH7NSY47Yj3LBhP25BCtCXu_IuVHEGjAcCWalcslcT0l0DxP1yr8F6gXlJgtujt57KZhMranupvU1SgBj7k3IG_k_mCyIpLdmjzN-kw6LPJWC_U_tkmlwBWDAMcXN9QQAL63Q3UwRIFjpqMhfRsAXiDvPZji0jS9WLuJUHlBpob-M04_-F1r_p7StzqDUY76-F_YXDmttR7_pZRp-_o1ch-6xmJhIndVtFfCF4ciP0_7rhg3Sq4Qt1TJiZMpTKdosXaqzoG7oST2SLrNYMt7Mp7jkFJcNXJatgb2PNT7hn9qUugKNN8iEeT999WVIzeuCK4m8UCR0ZJlbQ5nl_j9x4fuVF6N6p6bnTcU9AQfh4Uz70998q3AD2_RZs4bXJyaKoA1PZl4J-LBH8AsRENEjwbZdUE40WcnkiJEjNaywt7drRGtq4ou_BJRupUVHDsBhEvy32qINkJP8QmyBR9uGkYsT1enjQp60hXaG_fIpdhF1ktZIrYqiexw7JM-9ntpTyhZHWimtBqwR1d9l74oNXLXE6jXEMk7dypWjsof5VbN8fEom-azIsuOQFdr56ZnphfwEJJCCTLPXKxKqdRofvWXRSLaxyhkqDGRzee8wrohI6XxWfEva1IpgC7K5G03Hvx3roVl_RaKf6iftP_nqtgzfiq0dPtn5apR8aweCLo8wV7q26neazgpnD905nwz_HnPMDe6EkgXAaGm7Z4WJ9xDC-gUlNDVbdZcciWLTTr6IkvQPC8uQguYLLBgI-9iuPAVa9nyglYWfcZO_MCDth_nH4py3554LRb0HN3nTFJU63xwcB6iMe6OH1bsoHWidISm_qPSPH3C0UEf0AM4j9aOZbI-x2VmCPDwnWWsvvGDAZ0jzdkS51LEiiHE9jS00GDms9Ig4UBHnq7_q1NBcQtq1OAP6RltKysyJgNXeQIr_WiPqMEQ9wLvh8v95CeD41M_h5cJ7t1L6TqZ1kq0elJc2CRTAE5n5E5uzjIpnERftS-wus6j8xWtHOdZ9QnhmeykuS9WdELnBHBL0qmvD2IIMGRpwLnYVU9qhzohjudBDQ_5u5nwxq0X2oi4vatR37KHgRJReOz1kIYg6FdkdrQIg6vIPrV1SA7oSyoD3r49dHQN2Lb1dj1s4rDsPnEAi5H3nXlEngLnYlYNzNfKApaUDIYKffJbij9DntT7-vv0hF9v09NC_kyoyOdmP31QjcNM6ENqBQ0PnD8_XQ9mNPt5G9YfOP1EFkY0_hjHQ5gHwwFJqMzGANmv2Iccm5HPoC-QUeVLDMUyUjDS6eoiyM3_HYRg9LHgxiqPnRdvdbYO3VcZwJlSvrgRqPaOd_mkOGYvNMDHQ3PFqgfGX2rd6_Qb0P9hzAsV5-p5vZsh-IrVkR9NRKQ%5C%22%2C%5C%221c58a8bb106f380f201b7ffe4bd3863a%5C%22%2Cnull%2C%5B1%5D%2C1%2Cnull%2Cnull%2C1%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B0%5D%5D%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C1%2Cnull%2Cnull%2C%5B4%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B2%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C0%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5C%22873DA757-53C0-4A0F-BBF6-F541CB0805C0%5C%22%2Cnull%2C%5B%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C2%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C1%5D%22%5D&";

const GEMINI_HEADERS = {
  accept: "*/*",
  "accept-language": "pt-BR,pt;q=0.9",
  "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
  priority: "u=1, i",
  "x-goog-ext-525001261-jspb":
    "[1,null,null,null,\"fbb127bbb056c959\",null,null,0,[4],null,null,1,null,null,1,null,\"A4E58219-1D29-400A-8BB9-DF03D124B4C3\"]",
  "x-goog-ext-525005358-jspb": "[\"873DA757-53C0-4A0F-BBF6-F541CB0805C0\",1]",
  "x-goog-ext-73010989-jspb": "[0]",
  "x-goog-ext-73010990-jspb": "[0,0,0]",
  "x-same-domain": "1",
  Referer: "https://gemini.google.com/",
};

module.exports = {
  GEMINI_URL_TEMPLATE,
  GEMINI_BODY_TEMPLATE,
  GEMINI_HEADERS,
};
