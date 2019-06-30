<?php session_start(); ?>
<?php
 $target_dir = ($_POST["slozka_pro_vlozeni_souboru"]);
$target_file = "../".$target_dir ."/". basename($_FILES["fileToUpload"]["name"]); //bug s lomítkem
$adresa_pro_navrat =    ($_POST["navrat"]);
$uploadOk = 1;
$imageFileType = strtolower(pathinfo($target_file,PATHINFO_EXTENSION));
// Check if image file is a actual image or fake image
// if(isset($_POST["submit"])) {
    // $check = getimagesize($_FILES["fileToUpload"]["tmp_name"]);
    // if($check !== false) {
        // echo "File is an image - " . $check["mime"] . ".";
        // $uploadOk = 1;
    // } else {
        // echo "File is not an image.";
        // $uploadOk = 0;
    // }
// }
// Check if file already exists
if (file_exists($target_file)) {
    $_SESSION['vysledek'] = "Sorry, file already exists.";
    $uploadOk = 0;
}
// Check file size
// if ($_FILES["fileToUpload"]["size"] > 50000000000000) {
    // echo "Sorry, your file is too large.";
    // $uploadOk = 0;
// }
// Allow certain file formats
// if($imageFileType != "jpg" && $imageFileType != "png" && $imageFileType != "jpeg"
// && $imageFileType != "gif" ) {
    // echo "Sorry, only JPG, JPEG, PNG & GIF files are allowed.";
    // $uploadOk = 0;
// }
// Check if $uploadOk is set to 0 by an error
// if ($uploadOk == 0) {
    // echo "Sorry, your file was not uploaded.";
// if everything is ok, try to upload file
// } 
   else {
    if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) {
      $_SESSION['vysledek'] = "file ". basename( $_FILES["fileToUpload"]["name"]). " se nahrál.";
    } else {
        $_SESSION['vysledek'] = " error uploading  file: ". $target_file;
    }
 ; }
 header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  ); 
?>
 
