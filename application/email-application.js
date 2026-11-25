/* DRIVE2GIG completed application email and PDF export.
   Private form data is sent only when the applicant explicitly clicks Email and
   confirms the disclosure, and only when a secure endpoint is configured. */
(()=>{
  'use strict';
  const RECIPIENT='admin1gig2drive@drive2gig.com';
  const config=window.DRIVE2GIG_EMAIL_CONFIG||{};
  const btn=document.getElementById('emailCompleted');
  const downloadBtn=document.getElementById('downloadPDF');
  const status=document.getElementById('emailStatus');
  const approval=document.getElementById('emailPermission');
  let turnstileWidgetId=null;
  let turnstileResolve=null;
  let turnstileReject=null;
  if(!btn||!downloadBtn||!status||!approval)return;
  const h=(s)=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,'-').replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e]/g,'?');
  const safeName=(s)=>String(s||'Applicant').replace(/[^a-zA-Z0-9_-]/g,'_').substring(0,55);
  const basename=(d)=>'DRIVE2GIG_Completed_Application_'+safeName(d.fullName)+'.pdf';
  const asBytes=(str)=>Uint8Array.from(str, c=>c.charCodeAt(0)&255);
  const pdfText=(s)=>'('+h(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')';
  const fieldList=[
    ['RENTER INFORMATION',[
      ['Full legal name','fullName'],['Phone','phone'],['Email','email'],['Street address','address'],['City / state / ZIP','city'],['Driver license','license'],['Driver license expiration','expiry'],['Emergency contact','emergency']]],
    ['RENTAL DETAILS',[
      ['Vehicle','vehicle'],['VIN','vin'],['License plate','plate'],['Pickup location','pickup'],['Rental start date','start'],['Weekly / scheduled rate','rate'],['Payment interval','interval'],['Payment due','due'],['Deposit','deposit'],['30-day minimum amount','minimum'],['Mileage limit','miles'],['Approved territory','territory'],['Permitted work platforms','platforms']]],
    ['INSURANCE',[
      ['Insurance carrier','insurer'],['Insurance policy number','policy'],['Coverage effective date','effective'],['Coverage expiration','expires'],['Liability limits','limits'],['Insurance agent phone','agent'],['Insurance document filename','insuranceFileName'],['Coverage verified acknowledgment','insCovered'],['Maintain coverage acknowledgment','insMaintain']]],
    ['VEHICLE CONDITION',[
      ['Starting odometer','odometer'],['Fuel level','fuel'],['Existing damage or equipment notes','damage'],['Vehicle photo filenames','vehiclePhotoNames'],['Condition acknowledgment','conditionAck']]],
    ['RENTAL AGREEMENT ACKNOWLEDGMENTS',[
      ['30-day minimum acknowledged','ack30'],['Liability acknowledged','ackLiability'],['Disclosures acknowledged','ackDisclosure'],['Agreement terms acknowledged','ackTerms'],['Electronic record consent','consent']]],
    ['SIGNATURE INFORMATION',[
      ['Printed signer name','printedName'],['Date signed','signedDate']]]
  ];
  function allFields(d){
    const sections=[];
    for(const [title,fields] of fieldList){
      sections.push({type:'header',value:title});
      for(const [label,k] of fields){
        let v=d[k];
        if(Array.isArray(v))v=v.join(', ');
        if(typeof v==='boolean')v=v?'Yes':'No';
        sections.push({type:'field',value:label+': '+(v===undefined||v===null||v===''?'Not provided':String(v))});
      }
    }
    sections.push({type:'header',value:'APPLICATION RECORD'});
    sections.push({type:'field',value:'Business: DRIVE2GIG, 10012 N Cave Creek Rd, Phoenix, AZ 85020'});
    sections.push({type:'field',value:'Application PDF created: '+new Date().toLocaleString('en-US')});
    sections.push({type:'field',value:'Applicant acknowledgment: The online rental agreement terms were presented and acknowledged as recorded above.'});
    sections.push({type:'field',value:'Application is subject to owner review and acceptance; this email is not a confirmed booking.'});
    return sections;
  }
  // Dependency-free PDF generator: selectable text plus an embedded, drawn JPEG signature.
  function createPdf(d){
    const pageWidth=612,pageHeight=792,margin=42,lineHeight=13;
    const entries=[];
    for(const item of allFields(d)){
      if(item.type==='header'){entries.push({type:'header',text:h(item.value)});continue;}
      let text=h(item.value);
      const words=text.split(/\s+/);let current='';
      for(let word of words){
        while(word.length>88){if(current){entries.push({type:'field',text:current});current='';}entries.push({type:'field',text:word.slice(0,88)});word=word.slice(88)}
        if((current+' '+word).trim().length>88){entries.push({type:'field',text:current});current=word}else current=(current+' '+word).trim();
      }
      entries.push({type:'field',text:current||' '});
    }
    const pages=[];let curr=[],y=pageHeight-63;
    function next(){if(curr.length)pages.push(curr);curr=[];y=pageHeight-63}
    for(const item of entries){
      const need=item.type==='header'?24:lineHeight;
      if(y-need<86)next();
      curr.push({...item,y});y-=need;
    }
    if(curr.length)pages.push(curr);
    // A dedicated last page documents the signature without cropping it.
    pages.push([{type:'header',text:'ELECTRONIC SIGNATURE',y:pageHeight-63},{type:'field',text:h('Signed by: '+(d.printedName||d.fullName||'')),y:pageHeight-94},{type:'field',text:h('Date: '+(d.signedDate||'')),y:pageHeight-111},{type:'field',text:'Handwritten renter signature:',y:pageHeight-140}]);
    const canvas=document.getElementById('signature');
    const dataUrl=canvas.toDataURL('image/jpeg',0.85);
    const jpg=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));
    const objects=[null];
    function add(v){objects.push(v);return objects.length-1}
    const catalog=add(null),pageRoot=add(null),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const sigObj=add(['<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n',jpg,'\nendstream']);
    const pageObjs=[];
    pages.forEach((items,idx)=>{
      let contents='';
      const ty=(text,y,fontSize=10)=>'BT /F1 '+fontSize+' Tf 1 0 0 1 42 '+y+' Tm '+pdfText(text)+' Tj ET\n';
      contents+=ty('DRIVE2GIG - COMPLETED RENTAL APPLICATION',748,13);
      contents+='0.72 0.77 0.83 RG 42 737 m 570 737 l S\n0 0 0 RG\n';
      for(const item of items){
        if(item.type==='header')contents+=ty(item.text,item.y,11);
        else contents+=ty(item.text,item.y,9);
      }
      if(idx===pages.length-1)contents+='q 460 0 0 90 42 505 cm /Sig Do Q\n';
      contents+=ty('Page '+(idx+1)+' of '+pages.length,28,8);
      const cb=asBytes(contents);
      const streamObj=add(['<< /Length '+cb.length+' >>\nstream\n',cb,'\nendstream']);
      const obj=add('<< /Type /Page /Parent '+pageRoot+' 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+'] /Resources << /Font << /F1 '+font+' 0 R >> /XObject << /Sig '+sigObj+' 0 R >> >> /Contents '+streamObj+' 0 R >>');
      pageObjs.push(obj);
    });
    objects[catalog]='<< /Type /Catalog /Pages '+pageRoot+' 0 R >>';
    objects[pageRoot]='<< /Type /Pages /Count '+pageObjs.length+' /Kids ['+pageObjs.map(x=>x+' 0 R').join(' ')+'] >>';
    const chunks=[];let length=0;
    function pushBytes(bytes){chunks.push(bytes);length+=bytes.length}
    function pushText(str){pushBytes(asBytes(str))}
    pushText('%PDF-1.4\n%PDF\n');
    const offsets=[0];
    for(let i=1;i<objects.length;i++){
      offsets.push(length);pushText(i+' 0 obj\n');
      if(Array.isArray(objects[i])){
        for(const part of objects[i])if(typeof part==='string')pushText(part);else pushBytes(part);
      }else pushText(objects[i]);
      pushText('\nendobj\n');
    }
    const xref=length;
    pushText('xref\n0 '+objects.length+'\n0000000000 65535 f \n');
    for(let i=1;i<offsets.length;i++)pushText(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    pushText('trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
    return new Blob(chunks,{type:'application/pdf'});
  }
  function alertStatus(message,bad=false){
    status.style.display='block';status.style.borderLeftColor=bad?'#b42318':'#1688f2';
    status.textContent=message;
  }
  function pdfData(){
    if(!finalOK())return null;
    const data=getData();
    return {data,pdf:createPdf(data)};
  }
  function savePdf(blob,name){
    const a=document.createElement('a');const url=URL.createObjectURL(blob);
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  downloadBtn.addEventListener('click',()=>{
    const result=pdfData();if(!result)return;
    savePdf(result.pdf,basename(result.data));
    alertStatus('Completed application PDF downloaded. Keep a copy for your records.');
  });
  btn.addEventListener('click',async()=>{
    const result=pdfData();if(!result)return;
    if(!approval.checked){alertStatus('Please check the authorization box before emailing your application.',true);approval.focus();return}
    const {data,pdf}=result;
    if(!/^https:\/\//.test(config.endpoint||'')){
      alertStatus('Automatic email delivery is not connected yet. The PDF can be downloaded and emailed manually.',true);
      if(window.confirm('Automatic sending has not been configured. Download your completed PDF and open a pre-addressed email? You will need to attach the downloaded PDF and press Send.')){
        savePdf(pdf,basename(data));
        const subject=encodeURIComponent('DRIVE2GIG completed rental application - '+(data.fullName||'Applicant'));
        const body=encodeURIComponent('Hello DRIVE2GIG,\n\nPlease find my completed rental application PDF attached.\n\nApplicant: '+(data.fullName||'')+'\nPhone: '+(data.phone||'')+'\n\nPLEASE ATTACH THE DOWNLOADED PDF BEFORE SENDING.');
        window.location.href='mailto:'+RECIPIENT+'?subject='+subject+'&body='+body;
      }
      return;
    }
    if(pdf.size>5*1024*1024){alertStatus('The PDF is too large to email. Download it and contact DRIVE2GIG.',true);return}
    btn.disabled=true;btn.textContent='Sending securely...';
    alertStatus('Sending your completed application to DRIVE2GIG...');
    try{
      const form=new FormData();
      form.append('pdf',pdf,basename(data));
      form.append('fullName',data.fullName||'');
      form.append('replyEmail',data.email||'');
      form.append('phone',data.phone||'');
      form.append('consent','yes');
      if(!config.turnstileSiteKey||!window.turnstile||turnstileWidgetId===null)
        throw new Error('Secure email verification is not configured. Download the PDF or contact DRIVE2GIG.');
      const token=await new Promise((resolve,reject)=>{
        turnstileResolve=resolve;turnstileReject=reject;
        try{window.turnstile.execute(turnstileWidgetId)}catch(e){turnstileResolve=null;turnstileReject=null;reject(e)}
        setTimeout(()=>{if(turnstileReject){turnstileReject(new Error('Security check timed out.'));turnstileResolve=null;turnstileReject=null}},30000);
      });
      if(!token)throw new Error('Security verification was not completed.');
      form.append('turnstileToken',token);
      const resp=await fetch(config.endpoint,{method:'POST',body:form,mode:'cors',cache:'no-store'});
      let dataResponse={};try{dataResponse=await resp.json()}catch{}
      if(!resp.ok||dataResponse.ok!==true)throw new Error(dataResponse.error||('Email service returned HTTP '+resp.status));
      alertStatus('Application sent successfully to '+RECIPIENT+'. Keep a PDF copy for your records.');
    }catch(e){
      alertStatus('Email was not confirmed as sent: '+(e?.message||'Network error')+'. Download your PDF or try again.',true);
    }finally{btn.disabled=false;btn.textContent='Email completed application'}
  });
  if(config.turnstileSiteKey){
    const p=document.createElement('div');p.id='drive2gigTurnstile';
    status.before(p);
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;script.defer=true;
    script.onload=()=>{
      if(!window.turnstile)return;
      turnstileWidgetId=window.turnstile.render(p,{
        sitekey:config.turnstileSiteKey,
        size:'compact',
        execution:'execute',
        appearance:'interaction-only',
        callback:(token)=>{if(turnstileResolve)turnstileResolve(token);turnstileResolve=null;turnstileReject=null},
        'error-callback':()=>{if(turnstileReject)turnstileReject(new Error('Security check failed.'));turnstileResolve=null;turnstileReject=null}
      });
    };
    document.head.appendChild(script);
  }
})();
