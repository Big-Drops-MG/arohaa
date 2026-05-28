"use client"

export default function eSignConsent() {
  return (
    <div className="pas-esign-consent bg-[#F3F6FA] w-full h-full p-4 md:p-6 lg:px-14 lg:py-10 xl:px-20 xl:py-16">
      <div className="container mx-auto">
        <div className="pas-esign-consent-content w-full flex flex-col gap-6 md:gap-8 lg:gap-10 xl:gap-12">
          <div className="content-title">
            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center font-sans">Auto Assuritii E-SIGN Consent</h1>
          </div>
          <div className="content-body flex flex-col gap-4 md:gap-5 lg:gap-6 xl:gap-7 max-w-4xl mx-auto">
            <h3 className="text-lg lg:text-xl xl:text-2xl font-bold text-[#111827] font-sans bg-yellow-50 border-l-4 border-yellow-400 p-4 md:p-5 rounded">PLEASE PRINT AND RETAIN A COPY OF THIS CONSENT AGREEMENT FOR YOUR RECORDS.</h3>

            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>You are submitting a request to be matched with one of our third party lenders. To offer and process your loan, these third party lenders are required by law to provide you with certain communications, notices, disclosures, information and other materials (&quot;Communications&quot;). These third party lenders must obtain your consent in order to provide you with these Communications electronically.</p>

            <ol className="list-decimal list-inside space-y-3 md:space-y-4 text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans ml-4 md:ml-6" style={{ lineHeight: '1.6' }}>
              <li className="mb-3 md:mb-4">CONSUMER CONSENT. By submitting your request to be matched with lenders, you affirmatively consent and agree to receive all Communications required under law electronically. These Communications may be delivered to you via email or online at the website of the third party lender. You further affirmatively consent that your electronic signature on agreements and documents has the same effect as if you signed them in ink.</li>
              <li className="mb-3 md:mb-4">SCOPE OF CONSENT. You consents provided in Section 1 to receive Communications and to do business electronically applies to your request to WhiteCollar to be matched with third party lenders and to those third party lenders. Your consents also apply to all online interactions between you and the third party lenders, including those conducted via mobile devices.</li>
              <li className="mb-3 md:mb-4">WHAT YOU NEED - HARDWARE AND SOFTWARE REQUIREMENTS. In order to access and retain the Communications electronically, you will need the following:
                <ul className="list-disc list-inside space-y-2 md:space-y-3 mt-2 md:mt-3 ml-4 md:ml-6">
                  <li>Internet access through a browser that includes 128-bit encryption. Recommended browser standards are Microsoft Internet Explorer 8.0 and above, Mozilla Firefox 3.6 and above, Safari 7 or above.</li>
                  <li>Access to an email account</li>
                  <li>Adobe Acrobat Reader 6 or above</li>
                  <li>A printer or the ability to print the Communications</li>
                  <li>Long term storage device (such as your computer&apos;s disk drive) to retain a copy of the Communications</li>
                </ul>
              </li>
              <li className="mb-3 md:mb-4">REQUESTING PAPER RECORDS. You may request paper copies at of any Communications at no charge to you by contacting the third party lenders directly. Their contact information can be found on their website.</li>
              <li className="mb-3 md:mb-4">WITHDRAWING YOUR CONSENT. Because your consent may be required in order for some third party lenders to respond to your matching request and return a quote, your consent may not be withdrawn during the matching process. However, if you are matched with one or more third party lenders, you may withdraw your consent to do business electronically directly with those third party lenders.</li>
              <li className="mb-3 md:mb-4">CONTACT INFORMATION. You should keep third party lenders informed of any changes to your contact information. You may update such information by logging into the third party lender&apos;s website or by sending the lender a written update by mail.</li>
              <li className="mb-3 md:mb-4">LEGAL EFFECT. BY CLICKING THE LINK, YOU ASSENT TO THE TERMS. YOU ACKNOWLEDGE YOU HAVE READ THIS INFORMATION ABOUT ELECTRONIC SIGNATURES, RECORDS, DISCLOSURES, AND DOING BUSINESS ELECTRONICALLY. YOU CONSENT TO USING ELECTRONIC SIGNATURES, HAVING ALL DISCLOSURES PROVIDED OR MADE AVAILABLE TO YOU IN ELECTRONIC FORM AND TO DOING BUSINESS WITH THE LENDER ELECTRONICALLY. YOU ACKNOWLEDGE THAT YOU MAY REQUEST A PAPER COPY OF THE ELECTRONIC RECORDS AND DISCLOSURES, WHICH WILL BE PROVIDED TO YOU AT NO CHARGE. IF YOU REFRAIN FROM PROCEEDING THEN YOU NEITHER WISH TO USE ELECTRONIC SIGNATURES NOR CONDUCT THIS TRANSACTION ELECTRONICALLY. YOU ALSO ACKNOWLEDGE THAT YOUR CONSENT TO ELECTRONIC DISCLOSURES IS REQUIRED TO RECEIVE SERVICES FROM THIRD PARTY LENDERS OVER THE INTERNET.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

