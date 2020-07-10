const mysql = require('mysql');
const express = require('express');
const router = express.Router();
const db_config = require('../db-config/db-config.json'); // db 설정 정보 모듈화
const multer = require('multer');
const path = require('path') //파일명 중복을 막기위해서 사용

//mysql과의 연동 
const connection = mysql.createConnection({
    host: db_config.host,
    user: db_config.user,
    database: db_config.database,
    password: db_config.password,
    port: db_config.port
});

// multer 미들웨어 등록
const upload = multer({
    // S3에 파일 업로드 하는 방식이 2가지 1. 디스크에서 파일 업로드, 2. 파일 버퍼(메모리)를 업로드 
    // 지금방식은 1번 방식 
    storage: multer.diskStorage({ //저장될 경로 설정
        destination: function(req,file,cb){
            cb(null,'upload/');
        },
        filename: function(req,res,cb){ 
            // 저장될 파일명 설정 (중복을 막기위해서 파일명에 타임스탬프 사용)
            // 타임스탬프.확장자 형식으로 파일명 지정
            cb(null, new Date().valueOf() + path.extname(file.originalname));
        }
    }),
});

//menu 사진 올리는 부분
router.post('/menu/add',upload.single("img"),function(req,res){
    //파일 객체
    let file = req.file;
    //파일 정보
    let result ={
        originalName :file.originalname,
        size :file.size,
    }
    res.json(result);
})

//메뉴 등록 및 수정하는 부분 
router.post('/menu/add',function(req,res){
    const ownerEmail = req.body.ownerEmail;
    const menuName = req.body.menuName;
    const category = req.body.category;
    const price = req.body.price;
    const info = req.body.info;
    const decisionNum = req.body.decisionNum;
    
    if(decisionNum === 1){ //항목추가로 메뉴를 생성하는 경우 
        const sql = 'insert into Menus values(json_object("ownerEmail", ?, "category", ?, "menuName", ?, "price", ?, "info", ? ))';
        const params = [ownerEmail,category,menuName,price,info];

        connection.query(sql, params, function(err, result){
            let resultCode = 500;
            let message = "Server Error";
            if(err){
                console.log(err);
            }else{
                resultCode = 201;
                message = "Menu Registered";
            }
        });
    }else if(decisionNum === 2){ //생성된 메뉴 클릭하여 수정하는 경우 
        const menuOriginalName = req.body.menuOriginalName;
        const sql = 
        'update Menus set Menu = json_set(Menu,\'$."menuName"\', ?), Menu = json_set(Menu,\'$."category"\',?),Menu = json_set(Menu,\'$."price"\',?), Menu = json_set(Menu,\'$."info"\',?) where (json_extract(Menu,\'$."ownerEmail"\') = ? )and json_extract(Menu,\'$."menuName"\') =?';
        const params = [menuName,category,price,info,ownerEmail,menuOriginalName];

        connection.query(sql, params, function(err, result){
            let resultCode = 500;
            let message = "Server Error";
            if(err){
                console.log(err);
            }else{
                resultCode = 200;
                message = "Menu Modified";
            }
        });
    }
    res.json({
        'code' : resultCode,
        'message' : message
    });
    
});

//메뉴 정렬해서 보기
router.post('menu/align',function(req,res){
    const ownerEmail = req.body.ownerEmail;
    const category = req.body.category;
    const sql = 
    'select json_extract(Menu,\'$."menuName"\'), json_extract(Menu, \'$."category"\') from Menus where json_extract(Menu,\'$."ownerEmail"\') = ? && json_extract(Menu,\'$."category"\') = ?';
    const params = [ownerEmail,category];

    connection.query(sql, params, function(err, result){
        let resultCode = 500;
        let message = "Server Error";
        var resultArray = new Array(); 
        
        if(err){
            console.log(err);
        }else if(result.length === 0){
            resultCode = 400;
            message = "No Menu Exist"
        }else{
            var resultJson = new Object(); //쿼리 수행 결과를 한 쌍씩 object에 담고 object를 배열에 넣어줌 
            for(var i = 0; i < result.length; i++){
                resultJson.menuName = result[i].menuName;
                resultJson.category = result[i].category;
                resultArray.push(resultJson);
            }
            resultCode = 201;
            message = "Menu Aligned";
        }
        res.json({
            resultArray,
            'code' : resultCode,
            'message' : message
        });
    });
});

//등록된 메뉴 삭제하는 부분 (점주 이메일하고 메뉴이름 받아서 해당 메뉴 삭제)
router.post('menu/delete',function(req,res){
    const ownerEmail = req.body.ownerEmail;
    const menuName = req.body.menuName;
    const sql = 
    'delete from Menus where (json_exxtract(Menu,\'$."ownerEmail"\') = ? and json_extract(Menu,\'$."menuName"\')=?)'; 
    const params = [ownerEmail,menuName];

    connection.query(sql, params, function(err, result){
        let resultCode = 500;
        let message = "Server Error";

        if(err){
            console.log(err);
        }else{
            resultCode = 200;
            message = "Menu Deleted";
        }
        res.json({
            'code' : resultCode,
            'message' : message
        });
    });
});



//가게 등록하는 부분
router.post('/info/registore',function(req,res){
    const ownerEmail = req.body.ownerEmail;
    const ownerStoreName = req.body.ownerStoreName;
    const ownerStoreAddress = req.body.ownerStoreAddress;
    const sql = 
    'update Owners set OwnerStoreName = ? , OwnerStoreAddress = ? where OwnerEmail = ?';
    const params = [ownerStoreName,ownerStoreAddress,ownerEmail];

    connection.query(sql, params,function(err,result){
        let resultCode = 500;
        let message = "Server Error";

        if(err){
            console.log(err);
        }else if(result.length===0){
            resultCode = 400;
            message = 'Invalid Account';
        }else{
            resultCode = 201;
            message = 'Store Registered';    
        }
        res.json({
            'code' : resultCode,
            'message' : message
        });
    });
});


//회원 탈퇴부분
router.post('/info/withdraw',function(req,res){
    const ownerEmail = req.body.ownerEmail;
    const ownerWithdraw = true; //회원탈퇴하면 true값으로 변경 default = 0(false)
    const trashOwnerEmail = '0@0' //탈퇴하면 email중복검사에서 해당 email을 사용할 수 있게 하기 위해 trash email id 입력
    const sql = 
    'update Owners set IsOwnerDeleted = ? , OwnerEmail =? where OwnerEmail = ?';
    const params = [ownerWithdraw, trashOwnerEmail, ownerEmail];

    connection.query(sql, params,function(err,result){
        let resultCode = 500;
        let message = "Server Error";

        if(err){
            console.log(err);
        }else{
            resultCode = 200;
            message = 'Account Deleted';    
        }
        res.json({
            'code' : resultCode,
            'message' : message
        });
    });
});

//무엇을 export할지를 결정하는것 
module.exports = router;
