import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

function redirectToIndex() {
  window.location.href = "./index.html";
}

// If already logged in and still on login page, redirect
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const path = window.location.pathname.toLowerCase();
  if (path.includes("login")) {
    redirectToIndex();
  }
});


const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const githubProvider = new GithubAuthProvider();



const loginBtn = document.getElementById("loginBtn");
if(loginBtn){
loginBtn.onclick = () => {

const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

signInWithEmailAndPassword(auth,email,password)
.then(()=>{

alert("Login successful");
redirectToIndex();

})
.catch(err=>{

alert(err.message);

});

};
}


const signupBtn = document.getElementById("signupBtn");
if(signupBtn){

signupBtn.onclick = async () => {

const email = document.getElementById("signupEmail").value;
const password = document.getElementById("signupPassword").value;
const username = document.getElementById("signupUsername").value;

try {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await updateProfile(userCredential.user, {
    displayName: username,
  });

  // role_id: 1 = admin, 2 = user
  const role_id = 2;
  await setDoc(
    doc(db, "users", userCredential.user.uid),
    {
      uid: userCredential.user.uid,
      username,
      email,
      role_id,
      balance: 0,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  alert("Account created");
} catch (err) {
  alert(err.message);
}

};

}


const googleLogin = document.getElementById("googleLogin");
if(googleLogin){

googleLogin.onclick = () => {

signInWithPopup(auth,googleProvider)
.then(()=>{

alert("Google login successful");
redirectToIndex();

})
.catch(err=>{

alert(err.message);

});

};

}


const githubLogin = document.getElementById("githubLogin");
if(githubLogin){

githubLogin.onclick = () => {

signInWithPopup(auth,githubProvider)
.then(()=>{

alert("Github login successful");
redirectToIndex();

})
.catch(err=>{

alert(err.message);

});

};

}