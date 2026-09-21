///<reference path="jquery-1.4.2.min.js" />
function setHomepage(sURL) { // 设置首页
if (document.all){
document.body.style.behavior = 'url(#default#homepage)';
document.body.setHomePage(sURL);
}else if (window.sidebar){
if (window.netscape){
try {
netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
}catch (e) {
alert("该操作被浏览器拒绝，如果想启用该功能，请在地址栏内输入 about:config ,然后将项为signed.applets.codebase_principal_support的值改为true");
}
}
var prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
prefs.setCharPref('browser.startup.homepage', sURL);
}
}


function AddFavorite(sURL, sTitle) {
    try {
        window.external.addFavorite(sURL, sTitle);
    }
    catch (e) {
        try {
            window.sidebar.addPanel(sTitle, sURL, "");
        }
        catch (e) {
            alert("加入收藏失败，请使用Ctrl+D进行添加");
        }
    }
}

//首页轮播效果
function moduleRotatingShow(_themeId, conList) {
    this.emId = _themeId + "_focusImg";
    var local = conList.length - 1;
    var obj = {
        showImg: jQuery("#" + this.emId + " img"),
        showNav: jQuery("#" + this.emId + " div i"),
        showLink: jQuery("#" + this.emId + " div a")
    };
    var timer = null;

    function funPlay() {
        clearInterval(timer);
        timer = setInterval(funGo, 5000);
    };
    function funPause() {
        clearInterval(timer);
    };

    function funGo() {
        funShow(local);

        var img = new Image();
        img.src = conList[funNextLocal(local)].imgUrl;

        if (img.complete) {
            local = funNextLocal(local);
            return;
        }
        img.onload = function () {
            local = funNextLocal(local);
        };

    };

    this.inits = function () {
        funShow(local);
        local = funNextLocal(local);
        funPlay();

        obj.showNav.each(function (i) {
            jQuery(this).bind("mouseover", function () {
                funPause();
                funShow(i);
                funPlay();
            })
        });
    }
    function funNextLocal(_local) {
        var index = _local;
        index -= 1;
        if (index < 0) index = conList.length - 1;
        return index;
    }

    function funShow(_local) {
        with (obj) {
            showImg.attr("src", conList[_local].imgUrl);
            showImg.attr("title", conList[_local].title);
            //判断title是否超过长度
            if (conList[_local].title.length > 22)
                showLink.html(conList[_local].title.substr(0, 22) + "...");
            else
                showLink.html(conList[_local].title);

            if (conList[_local].lingUrl != "#") {
                showImg.parent().attr("target", "_blank");
                showImg.parent().attr("href", conList[_local].lingUrl);
                showLink.attr("target", "_blank");
                showLink.attr("href", conList[_local].lingUrl);
                showLink.attr("title", conList[_local].title);
            }
            else {
                showImg.parent().attr("target", "_self");
                showImg.parent().attr("href", "javascript:void(0)");
                showLink.attr("target", "_self");
                showLink.attr("href", "javascript:void(0)");
                showLink.attr("title", conList[_local].title);
            }
            showNav.removeClass("cur");
            jQuery(obj.showNav[_local]).addClass("cur");
        }
    };
}


function srcMarquee() {
    this.ID = document.getElementById(arguments[0]);
    if (!this.ID) { this.ID = -1; return; }
    this.Direction = this.Width = this.Height = this.DelayTime = this.WaitTime = this.Correct = this.CTL = this.StartID = this.Stop = this.MouseOver = 0;
    this.Step = 1;
    this.Timer = 30;
    this.DirectionArray = { "top": 0, "bottom": 1, "left": 2, "right": 3 };
    if (typeof arguments[1] == "number") this.Direction = arguments[1];
    if (typeof arguments[2] == "number") this.Step = arguments[2];
    if (typeof arguments[3] == "number") this.Width = arguments[3];
    if (typeof arguments[4] == "number") this.Height = arguments[4];
    if (typeof arguments[5] == "number") this.Timer = arguments[5];
    if (typeof arguments[6] == "number") this.DelayTime = arguments[6];
    if (typeof arguments[7] == "number") this.WaitTime = arguments[7];
    if (typeof arguments[8] == "number") this.ScrollStep = arguments[8]
    this.ID.style.overflow = this.ID.style.overflowX = this.ID.style.overflowY = "hidden";
    this.ID.noWrap = true;
    this.IsNotOpera = (navigator.userAgent.toLowerCase().indexOf("opera") == -1);
    if (arguments.length >= 7) this.Start();
}
srcMarquee.prototype.Start = function () {
    if (this.ID == -1) return;
    if (this.WaitTime < 800) this.WaitTime = 800;
    if (this.Timer < 20) this.Timer = 20;
    if (this.Width == 0) this.Width = parseInt(this.ID.style.width);
    if (this.Height == 0) this.Height = parseInt(this.ID.style.height);
    if (typeof this.Direction == "string") this.Direction = this.DirectionArray[this.Direction.toString().toLowerCase()];
    this.HalfWidth = Math.round(this.Width / 2);
    this.BakStep = this.Step;
    this.ID.style.width = this.Width;
    this.ID.style.height = this.Height;
    if (typeof this.ScrollStep != "number") this.ScrollStep = this.Direction > 1 ? this.Width : this.Height;
    var msobj = this;
    var timer = this.Timer;
    var delaytime = this.DelayTime;
    var waittime = this.WaitTime;
    msobj.StartID = function () { msobj.Scroll() }
    msobj.Continue = function () {
        if (msobj.MouseOver == 1) {
            setTimeout(msobj.Continue, delaytime);
        }
        else {
            clearInterval(msobj.TimerID);
            msobj.CTL = msobj.Stop = 0;
            msobj.TimerID = setInterval(msobj.StartID, timer);
        }
    }
    msobj.Pause = function () {
        msobj.Stop = 1;
        clearInterval(msobj.TimerID);
        setTimeout(msobj.Continue, delaytime);
    }
    msobj.Begin = function () {
        msobj.ClientScroll = msobj.Direction > 1 ? msobj.ID.scrollWidth : msobj.ID.scrollHeight;
        if ((msobj.Direction <= 1 && msobj.ClientScroll < msobj.Height) || (msobj.Direction > 1 && msobj.ClientScroll < msobj.Width)) return;
        msobj.ID.innerHTML += msobj.ID.innerHTML;
        msobj.TimerID = setInterval(msobj.StartID, timer);
        if (msobj.ScrollStep < 0) return;
        msobj.ID.onmousemove = function (event) {
            if (msobj.ScrollStep == 0 && msobj.Direction > 1) {
                var event = event || window.event;
                if (window.event) {
                    if (msobj.IsNotOpera) { msobj.EventLeft = event.srcElement.id == msobj.ID.id ? event.offsetX - msobj.ID.scrollLeft : event.srcElement.offsetLeft - msobj.ID.scrollLeft + event.offsetX; }
                    else { msobj.ScrollStep = null; return; }
                }
                else { msobj.EventLeft = event.layerX - msobj.ID.scrollLeft; }
                msobj.Direction = msobj.EventLeft > msobj.HalfWidth ? 3 : 2;
                msobj.AbsCenter = Math.abs(msobj.HalfWidth - msobj.EventLeft);
                msobj.Step = Math.round(msobj.AbsCenter * (msobj.BakStep * 2) / msobj.HalfWidth);
            }
        }
        msobj.ID.onmouseover = function () {
            if (msobj.ScrollStep == 0) return;
            msobj.MouseOver = 1;
            clearInterval(msobj.TimerID);
        }
        msobj.ID.onmouseout = function () {
            if (msobj.ScrollStep == 0) {
                if (msobj.Step == 0) msobj.Step = 1;
                return;
            }
            msobj.MouseOver = 0;
            if (msobj.Stop == 0) {
                clearInterval(msobj.TimerID);
                msobj.TimerID = setInterval(msobj.StartID, timer);
            } 
        } 
    }
    setTimeout(msobj.Begin, waittime);
}
srcMarquee.prototype.Scroll = function () {
    switch (this.Direction) {
        case 0:
            this.CTL += this.Step;
            if (this.CTL >= this.ScrollStep && this.DelayTime > 0) {
                this.ID.scrollTop += this.ScrollStep + this.Step - this.CTL;
                this.Pause();
                return;
            }
            else {
                if (this.ID.scrollTop >= this.ClientScroll) { this.ID.scrollTop -= this.ClientScroll; }
                this.ID.scrollTop += this.Step;
            }
            break;
        case 1:
            this.CTL += this.Step;
            if (this.CTL >= this.ScrollStep && this.DelayTime > 0) {
                this.ID.scrollTop -= this.ScrollStep + this.Step - this.CTL;
                this.Pause();
                return;
            }
            else {
                if (this.ID.scrollTop <= 0) { this.ID.scrollTop += this.ClientScroll; }
                this.ID.scrollTop -= this.Step;
            }
            break;
        case 2:
            this.CTL += this.Step;
            if (this.CTL >= this.ScrollStep && this.DelayTime > 0) {
                this.ID.scrollLeft += this.ScrollStep + this.Step - this.CTL;
                this.Pause();
                return;
            }
            else {
                if (this.ID.scrollLeft >= this.ClientScroll) { this.ID.scrollLeft -= this.ClientScroll; }
                this.ID.scrollLeft += this.Step;
            }
            break;
        case 3:
            this.CTL += this.Step;
            if (this.CTL >= this.ScrollStep && this.DelayTime > 0) {
                this.ID.scrollLeft -= this.ScrollStep + this.Step - this.CTL;
                this.Pause();
                return;
            }
            else {
                if (this.ID.scrollLeft <= 0) { this.ID.scrollLeft += this.ClientScroll; }
                this.ID.scrollLeft -= this.Step;
            }
            break;
    }
}

function SwapImage(index,pn,id) {
    var div = "news_div_";
    var img = "menu_r1_c";
    var img_o = "menuhover_r1_c";
    for (var i = 1; i < 5; i++) {
        if (index == i) {
            $("#" + div + index).show();
            $("#n_d_" + index).attr("src", "images/" + img_o + index + ".jpg");
            $("#n_d_link").attr("href",pn+id+".htm");
        }
        else {
            $("#" + div + i).hide();
            $("#n_d_"+i).attr("src", "images/" + img + i + ".jpg");
        }
    }
}

function Search1() {
    var url = window.location.href.toLowerCase();
    if ($.trim($("#field").val()) != "" && $.trim($("#field").val()) != "请输入标题或文号")
        window.location = url.substr(0, url.indexOf('.htm')) + ".htm?con=" + encodeURIComponent($("#field").val());
    else
        window.location = url.substr(0, url.indexOf('.htm')) + ".htm";
}

function Search() {
    if ($.trim($("#field").val()) != "")
        window.location = "search.htm?con=" + encodeURIComponent($("#field").val());
    else {
        alert("请输入要搜索的关键字！");
        $("#field").focus();
    }
}

//实现回车点击按钮事件
/*
obj：当前获得焦点的对象 this
evt：事件 event
clickObjID：触发点击事件的对象ID
*/
function SubmitKeyClick(obj, evt, clickObjID) {
    evt = (evt) ? evt : ((window.event) ? window.event : "")
    keyCode = evt.keyCode ? evt.keyCode : (evt.which ? evt.which : evt.charCode);
    if (keyCode == 13) {
        if (document.all) {
            document.getElementById(clickObjID).click();
        }
        else {
            evt = document.createEvent("MouseEvents");
            evt.initEvent("click", true, true);
            document.getElementById(clickObjID).dispatchEvent(evt);
        }
    }
}

function checkGBData() {
    if ($("#ContentPlaceHolder1_lx").find("input[checked=true]").length == 0) {
        alert("请选择类型！");
        $("#ContentPlaceHolder1_lx").focus();
        return false;
    }

    if ($.trim($("#ContentPlaceHolder1_subject").val()) == "") {
        alert("标题不能为空！");
        $("#ContentPlaceHolder1_subject").focus();
        return false;
    }

    if ($.trim($("#ContentPlaceHolder1_content").val()) == "") {
        alert("内容不能为空！");
        $("#ContentPlaceHolder1_content").focus();
        return false;
    }

    if ($.trim($("#ContentPlaceHolder1_linkman").val()) == "") {
        alert("联系人不能为空！");
        $("#ContentPlaceHolder1_linkman").focus();
        return false;
    }
    if ($.trim($("#ContentPlaceHolder1_linkman").val()).length < 2) {
        alert("无效的联系人姓名！");
        $("#ContentPlaceHolder1_linkman").focus();
        $("#ContentPlaceHolder1_linkman").select();
        return false;
    }

    if ($.trim($("#ContentPlaceHolder1_qh").val()) != "" && $.trim($("#ContentPlaceHolder1_qh").val()) != "区号") {
        if (!/^[0-9]{1,20}$/.test($.trim($("#ContentPlaceHolder1_qh").val()))) {
            alert("区号必须是数字！");
            $("#ContentPlaceHolder1_qh").focus();
            return false;
        }

        if (!/^[0-9]{1,20}$/.test($.trim($("#ContentPlaceHolder1_code").val()))) {
            alert("电话号码必须是数字！");
            $("#ContentPlaceHolder1_code").focus();
            return false;
        }
    }

    if ($.trim($("#ContentPlaceHolder1_fj").val()) != "" && $.trim($("#ContentPlaceHolder1_fj").val()) != "分机") {
        if (!/^[0-9]{1,20}$/.test($.trim($("#ContentPlaceHolder1_fj").val()))) {
            alert("分机号必须是数字！");
            $("#ContentPlaceHolder1_fj").focus();
            return false;
        }
    }

    if ($.trim($("#ContentPlaceHolder1_telphone").val()) != "") {
        if (!/^[0-9+]{1,20}$/.test($.trim($("#ContentPlaceHolder1_telphone").val()))) {
            alert("无效的手机号码！");
            $("#ContentPlaceHolder1_telphone").focus();
            return false;
        }
    }


    if ($.trim($("#ContentPlaceHolder1_email").val()) != "") {
        if (!/^\w+((-|\.)\w+)*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/.test($.trim($("#ContentPlaceHolder1_email").val()))) {
            alert("无效的邮件格式！");
            $("#ContentPlaceHolder1_email").focus();
            return false;
        }
    }
    if ($.trim($("#ContentPlaceHolder1_chkCode").val()) == "") {
        alert("验证码不能为空！");
        $("#ContentPlaceHolder1_chkCode").focus();
        return false;
    }
    if ($.trim($("#ContentPlaceHolder1_chkCode").val()).length != 6) {
        alert("请输入6位验证码！");
        $("#ContentPlaceHolder1_chkCode").focus();
        return false;
    }

    return true;
}

$(document).ready(function () {
    $("#login").click(function () {
        if ($.trim($("#username").val()) == "") {
            alert("请输入用户名！");
            $("#username").focus();
            return;
        }
        if ($.trim($("#userpwd").val()) == "") {
            alert("请输入密码！");
            $("#userpwd").focus();
            return;
        }

        $("#gkfrm").attr("action", "http://hz.gaokor.com/Handler/GKLogin.ashx");
        $("#gkfrm").attr("method", "post");
        $("#gkun").val($("#username").val());
        $("#gkpwd").val($("#userpwd").val());
        $("#appid").val(4);
        $("#gkfrm").submit();
    });
});

function VIP_Form() {
    if ($.trim($("#ContentPlaceHolder1_Company").val()).length < 4) { alert("单位名称不能少于4个字符！"); $("#ContentPlaceHolder1_Company").focus(); return false; }

//    if ($.trim($("#ContentPlaceHolder1_RealName").val()) == "") { alert("法人代表不能为空！"); $("#ContentPlaceHolder1_RealName").focus(); return false; }
//    if ($.trim($("#ContentPlaceHolder1_Sex").val()) == "") { alert("请选择法人代表性别！"); $("#ContentPlaceHolder1_Sex").focus(); return false; }
    //企业网址
    if ($.trim($("#ContentPlaceHolder1_WebURL").val()) != "")
    { if (!TestUrl($.trim($("#ContentPlaceHolder1_WebURL").val()))) { alert("单位网址无效，正确格式如：http://www.sohu.com ！"); $("#ContentPlaceHolder1_WebURL").focus(); return false; } }

    //成立时间
    if (!IsDate($.trim($("#ContentPlaceHolder1_N_Time").val()))) {
        alert("成立时间无效，正确格式如：1988-12-08 ！"); $("#ContentPlaceHolder1_N_Time").focus(); return false; 
    }
    //注册地址 
    if ($.trim($("#ContentPlaceHolder1_N_Address").val()) == "") { alert("注册地址不能为空！"); $("#ContentPlaceHolder1_N_Address").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_N_Category").val()) == "") { alert("所属行业不能为空！"); $("#ContentPlaceHolder1_N_Category").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_address").val()) == "") { alert("通讯地址不能为空！"); $("#ContentPlaceHolder1_address").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_postCode").val()) == "" || $("#ContentPlaceHolder1_postCode").val() == "0") { alert("邮编不能为空！"); $("#ContentPlaceHolder1_postCode").focus(); return false; }



    if ($.trim($("#ContentPlaceHolder1_MrealName").val()) == "") { alert("参会负责人姓名不能为空！"); $("#ContentPlaceHolder1_MrealName").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_MSex").val()) == "") { alert("请选择参会负责人性别！"); $("#ContentPlaceHolder1_MSex").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_N_BornDate").val()) != "") {
        if (!IsDate($.trim($("#ContentPlaceHolder1_N_BornDate").val()))) {
            alert("出生日期无效，正确格式如：1970-12-21 ！"); $("#ContentPlaceHolder1_N_BornDate").focus(); return false;
    }}
    
    if ($.trim($("#ContentPlaceHolder1_MPost").val()) == "") { alert("参会负责人职务不能为空！"); $("#ContentPlaceHolder1_MPost").focus(); return false; }
    //个人Email Email
    if (!checkEmails($.trim($("#ContentPlaceHolder1_Email").val())))
    { alert("参会负责人Email地址无效！"); $("#ContentPlaceHolder1_Email").focus(); return false; }


    //联系人电话 LinkPhone
    if (!IsTelNum(g("ContentPlaceHolder1_MPhone")))
    { alert("参会负责人办公电话无效，正确格式如：0571-85069996！"); $("#ContentPlaceHolder1_MPhone").focus(); return false; }
    if (!IsTelNum(g("ContentPlaceHolder1_N_Fax")))
    { alert("参会负责人传真号码无效，正确格式如：0571-85069996！"); $("#ContentPlaceHolder1_N_Fax").focus(); return false; }
    //联系人电话手机 LMobilePhone
    if (!isMobilePhone(g("ContentPlaceHolder1_MMobilePhone")))
    { alert("参会负责人手机号码无效！"); $("#ContentPlaceHolder1_MMobilePhone").focus(); return false; }


 
    if ($.trim($("#ContentPlaceHolder1_LinkMan").val()) == "") { alert("联络人姓名不能为空！"); $("#ContentPlaceHolder1_LinkMan").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_N_Sex").val()) == "") { alert("请选择联络人性别！"); $("#ContentPlaceHolder1_N_Sex").focus(); return false; }

    //单位电话 ComPhone
    if (!IsTelNum(g("ContentPlaceHolder1_ComPhone")))
    { alert("联络人办公电话无效，正确格式如：0571-85069996！"); $("#ContentPlaceHolder1_ComPhone").focus(); return false; }
    //传真 Fax
    if (!IsTelNum(g("ContentPlaceHolder1_Fax")))
    { alert("联络人传真号码无效！"); $("#ContentPlaceHolder1_Fax").focus(); return false; }
    if (!isMobilePhone(g("ContentPlaceHolder1_N_MobilePhone")))
    { alert("联络人手机号码无效！"); $("#ContentPlaceHolder1_N_MobilePhone").focus(); return false; }
    if (!checkEmails($.trim($("#ContentPlaceHolder1_N_Email").val())))
    { alert("联络人电子邮箱无效！"); $("#ContentPlaceHolder1_N_Email").focus(); return false; }


    if ($.trim($("#ContentPlaceHolder1_SalesNum").val()) == "") { alert("年销售额不能为空！"); $("#ContentPlaceHolder1_SalesNum").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_SalesNum").val()) == "0") { alert("年销售额不能为0！"); $("#ContentPlaceHolder1_SalesNum").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_N_TotalAssets").val()) == "") { alert("资产总额不能为空！"); $("#ContentPlaceHolder1_N_TotalAssets").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_N_TotalAssets").val()) == "0") { alert("资产总额不能为0！"); $("#ContentPlaceHolder1_N_TotalAssets").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_N_BusinessArea").val()) == "") { alert("营业面积不能为空！"); $("#ContentPlaceHolder1_N_BusinessArea").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_N_BusinessArea").val()) == "0") { alert("营业面积不能为0！"); $("#ContentPlaceHolder1_N_BusinessArea").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_WorksNum").val()) == "") { alert("企业人数不能为空！"); $("#ContentPlaceHolder1_WorksNum").focus(); return false; }
    if ($.trim($("#ContentPlaceHolder1_WorksNum").val()) == "0") { alert("企业人数不能为0！"); $("#ContentPlaceHolder1_WorksNum").focus(); return false; }

    if ($.trim($("#ContentPlaceHolder1_RunRange").val()) == "") { alert("经营项目不能为空！"); $("#ContentPlaceHolder1_RunRange").focus(); return false; }
    if (confirm("确认表单信息都填写正确吗？")) {
        return true;
    }
    else
        return false;
}