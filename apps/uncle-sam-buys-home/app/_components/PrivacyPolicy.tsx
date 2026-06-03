"use client"

const tdBase = "border border-gray-300 p-2 align-top text-xs lg:text-sm text-[#374151] font-sans"
const thBase = "border border-gray-300 p-2 text-left font-semibold text-[#111827] text-xs lg:text-sm font-sans bg-gray-100"

const RETENTION = "Retained indefinitely, unless the consumer requests that their information be deleted"

function Cb({ checked, label }: { checked: boolean; label: string }) {
  return (
    <p className="flex gap-1 mt-0.5">
      <span className="flex-shrink-0">{checked ? "☒" : "☐"}</span>
      <span>{label}</span>
    </p>
  )
}

function NA() {
  return <p className="text-gray-500 italic">Not applicable</p>
}

export default function PrivacyPolicy() {
  return (
    <div className="privacy-policy bg-[#F3F6FA] w-full h-full p-4 md:p-6 lg:px-14 lg:py-10 xl:px-20 xl:py-16">
      <div className="container mx-auto">
        <div className="privacy-policy-content w-full flex flex-col gap-6 md:gap-8 lg:gap-10 xl:gap-12">
          <div className="content-title">
            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#111827] text-center font-sans">Privacy Policy</h1>
          </div>
          <div className="content-body flex flex-col gap-4 md:gap-5 lg:gap-6 xl:gap-7 max-w-5xl mx-auto w-full">

            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>Last Updated: January 1, 2025</p>

            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Uncle Sam Buys Homes (&quot;Company&quot; &quot;we&quot; or &quot;our&quot;) is committed to advising you of the right to your privacy, and strives to provide a safe and secure user experience. This Privacy Policy explains how we collect, store, and use personal information provided by you on this website (the &quot;Website&quot;). This Privacy Policy also explains your rights in relation to your personal information and how to contact us. By accessing, using, or submitting information our Website, you explicitly accept, without limitation or qualification, the collection, use, and transfer of the personal information in the manner described in this Privacy Policy. Please read this Privacy Policy carefully, as it affects your rights and liabilities under the law. If you disagree with the way we collect and process personal information, please do not use this Website.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Information We Collect</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We have collected personal information about visitors to our Website in the preceding twelve (12) months, as noted here:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans" style={{ minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th className={`${thBase} w-1/4`}>Categories of (PI)</th>
                    <th className={`${thBase} w-1/4`}>Categories of Sources from which the Personal Information is collected from?</th>
                    <th className={`${thBase} w-5/12`}>Business Purpose</th>
                    <th className={`${thBase} w-1/6`}>Length of Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Identifiers</p>
                      <p className="text-xs">(e.g., a real name, alias, postal address, unique personal identifier, online identifier, Internet Protocol address, email address, account name, social security number, driver&apos;s license number, passport number, or other similar identifiers), or information that identifies, relates to, describes, or is capable of being associated with, a particular individual</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={true} label="Advertising networks" />
                      <Cb checked={true} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={true} label="Operating systems and platforms" />
                      <Cb checked={true} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={true} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Characteristics of protected classifications</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={false} label="Operating systems and platforms" />
                      <Cb checked={false} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Commercial information</p>
                      <p className="text-xs">(e.g., records of personal property, products or services purchased, obtained, or considered, or other purchasing or consuming histories or tendencies)</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={false} label="Operating systems and platforms" />
                      <Cb checked={false} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Biometric information</p>
                      <Cb checked={true} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Internet or other electronic network activity information</p>
                      <p className="text-xs">(e.g., browsing history, search history, and information regarding a consumer&apos;s interaction with an Internet Web site, application, or advertisement)</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={true} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={true} label="Operating systems and platforms" />
                      <Cb checked={false} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={true} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Geolocation data</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={true} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={true} label="Operating systems and platforms" />
                      <Cb checked={true} label="Social networks" />
                      <Cb checked={false} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={true} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Audio, electronic, visual, thermal, olfactory, or similar information (sensory data)</p>
                      <Cb checked={true} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Professional or employment-related information</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={false} label="Operating systems and platforms" />
                      <Cb checked={false} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Education information</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={false} label="Operating systems and platforms" />
                      <Cb checked={false} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={false} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Inferences drawn from any of the information identified above to create a profile about a consumer reflecting their preferences, characteristics, psychological trends, predispositions, behavior, attitudes, intelligence, abilities, and aptitudes</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={true} label="ISPs" />
                      <Cb checked={false} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={true} label="Operating systems and platforms" />
                      <Cb checked={true} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Sensitive personal information</p>
                      <Cb checked={false} label="not applicable (not collected)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Consumer directly" />
                      <Cb checked={false} label="Advertising networks" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={true} label="Data analytics providers" />
                      <Cb checked={false} label="Gov't entities" />
                      <Cb checked={false} label="Operating systems and platforms" />
                      <Cb checked={true} label="Social networks" />
                      <Cb checked={true} label="Data brokers" />
                      <Cb checked={false} label="Other third parties" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use, provided that the personal information is not disclosed to another third party and is not used to build a profile about a consumer or otherwise alter an individual consumer's experience outside the current interaction, including, but not limited to, the contextual customization of ads shown as part of the same interaction" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device that is owned, manufactured, manufactured for, or controlled by the business, and to improve, upgrade, or enhance the service or device that is owned, manufactured, manufactured for, or controlled by the business" />
                    </td>
                    <td className={tdBase}>{RETENTION}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              As noted in the above chart, we collect the above personal information directly from you via the Website, and from your interactions with the Website, including any personal information which you provide directly or indirectly.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Directly:</strong> We collect any personal information which you submit directly to the Website, including whether you indicated an interest in the products and/or services featured on the Website, and all personal information that you submit through the Website in conjunction with your request for information about the featured products and/or services. For instance, in conjunction with your request and/or information that you submit on the Website, we collect any information input through our webform (which may include but is not limited to your name, address, phone number, email address, date of birth, etc.). To the extent that you contact us through the Website, we also collect the personal information that you submit in conjunction with your communication.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Indirectly:</strong> We collect personal information about you that we acquire from a third party which may include identifying, demographic, behavioral, and indirect information. This collection may include, but is not limited to, first party cookies, third party cookies, anonymous cookies, persistent identifiers, email opt in, and search engine keywords. We have no access or control over these cookies and other tracking devices used by data aggregators, third party advertisers, and third party networks. We have no responsibility or liability for the policies and practices of these third parties.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              This Website uses cookies to automatically collect information from you when you visit our Website. This includes internet protocol (IP) addresses, browser type, internet service provider (ISP), referring/exit pages, operating system, date/time stamp, and/or clickstream data. This information is collected through the use of cookies, Web beacons, pixels/third party tracking technologies, and/or JavaScript. This also includes information which is contained within the autofill functionality of your browser.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Cookies, Web Beacons, Pixels/Third Party Tracking Technologies, and JavaScript</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Generally, we as well as third party vendors and supporting advertisers use technologies such as cookies, web beacons, and JavaScript to collect information. These technologies collect internet protocol (IP) addresses, browser type, internet service provider (ISP), referring/exit pages, operating system, date/time stamp, and/or clickstream data. This information is used to analyze trends, administer our Website, track user&apos;s movements through our Website and gather demographic information about our user base as a whole. We may receive reports based on these technologies on an individual or aggregated basis.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              &quot;Cookies&quot; are a feature in your browser software. If enabled, cookies store small amounts of data on your computer about actions you take on the pages of our Website including the placement of identifiers. Cookies assist us in tracking which of our features you visit most often, and what content you viewed on past visits. When you visit this Website again, cookies allow us to remember your settings and may be used for authentication. We may use cookies to keep track of the number of return visits, accumulate and aggregate statistical information generally pertaining to our Website, and deliver specific content to you based on your past viewing history. You can disable cookies, although our Website may not function properly for you. Your browser preferences can be modified to accept or reject all cookies, or request a notification when a cookie is set. You may read more about cookies at{' '}
              <a href="http://cookiecentral.com" className="text-blue-600 hover:text-blue-800 underline">http://cookiecentral.com</a>. In order to use all of the features and functionality of our Website, you need to accept cookies.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Third Party Cookies.</strong> We allow third party vendors and advertisers to set their own cookies on and through our Website. We have no control over the practices of those third parties and are not responsible for their technology or tracking. We encourage you to review the policies of such persons or entities on their websites. We use AdWords Remarketing through Google which is a Remarketing and Behavioral Targeting service provided by Google that connects the activity on our Website with the AdWords advertising network and the DoubleClick cookie. That Cookie collects information regarding certain patterns in your browsing history. To opt-out of this tracking, please see{' '}
              <a href="https://support.google.com/ads/answer/2662922?hl=en" className="text-blue-600 hover:text-blue-800 underline">https://support.google.com/ads/answer/2662922?hl=en</a>. We also participate in all of Google Analytics Advertising. This includes (i) Remarketing with Google Analytics; (ii) Google Display Network Impression Reporting; (iii) DoubleClick Campaign Manager integration; and (iv) Google Analytics Demographics and Interest Reporting. Google uses cookies to track activity performed by Google Analytics and its AdWords or DoubleClick cookie. To opt-out please see{' '}
              <a href="https://tools.google.com/dlpage/gaoptout/" className="text-blue-600 hover:text-blue-800 underline">https://tools.google.com/dlpage/gaoptout/</a>. We also use Google Analytics which is an analysis service also provided by Google. Google utilizes the data collected through its cookies to track and examine the use of this site, to prepare reports on its activities, and to share them with other Google services. You may opt-out of the Google Analytics service using Google&apos;s Browser Add-on available at{' '}
              <a href="https://tools.google.com/dlpage/gaoptout/" className="text-blue-600 hover:text-blue-800 underline">https://tools.google.com/dlpage/gaoptout/</a>.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Social Media Cookies/Plug-ins.</strong> Plug-ins for social media including Facebook, Twitter, LinkedIn, Yahoo, Windows and Google Plus are integrated on our Website. By interacting with us through a social media plug-in, certain information will be transmitted to the social network and you permit us to have continued access to information from your profile. Social media features are either hosted by a third party or hosted directly on our Website. Your interactions with these features are governed by the privacy policy of the company providing it.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Web Beacons.</strong> We use electronic images known as Web Beacons (sometimes called single-pixel gifs, clear gifs or action tags) which allow us to collect information about your visit to our Website, measure and improve the effectiveness of advertisements and track delivery of advertising. Web Beacons collect only a limited set of information including a cookie number, time and date of page view, as well as a description of the page on which the Web Beacon resides. We may also use Web beacons in email messages sent to you. This allows us to determine if you opened or acted upon the email messages. Because Web beacons are the same as any other content request, you cannot opt out or refuse them. However, they can be rendered ineffective by either opting out of cookies or changing the cookie setup in your browser.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>JavaScript.</strong> We may also use JavaScript. JavaScript is a computer language that enhances the functionality of websites, particularly with respect to pictures. We use it to analyze and improve our Website&apos;s functions. You may deactivate JavaScript through your browser settings or activate it the same way. If you disable JavaScript, you will not be able to use some of the functions of our Website.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Proprietary Auto-Fill Tracking.</strong> At times, we use third party vendors who have technology which collects information held in your browser&apos;s auto-fill functionality. This collection allows them to notify you of an error in the registration or a failure to submit the registration. You can stop this functionality by turning it off in your browser. There is no loss of use of our Website or services should this browser function be turned off.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Pixels and Third Party Tracking Technologies.</strong> This Website utilizes third party service providers, including ActiveProspect (Trusted Form) and Jornaya, each of whom provide pixels which are placed on the Website to record consumer activity and interaction on the Site, such as scrolling, pages viewed, and buttons clicked. In addition, such third party tracking technologies track any entry of information into the Website&apos;s webform, including key strokes and click stream data, for the purpose of tracking Website activity, and documenting and retaining a record of consumer consent. Through your decision to enter information, you consent to our use of such third party tracking technologies.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Please note that other third parties, including Meta, provide pixels which are placed on the Website. Such pixels similarly collect consumer activity and interactions on the Website, such as scrolling, pages viewed, and buttons clicked, devices used to access the Site, IP addresses, and timestamps. Such third parties may use such data collected via such pixels on our Website for their own advertising and marketing purposes. To the extent that you have a Facebook account, please note that Meta may link information collected through its pixel to your Facebook account and use such for its own personalized advertising purposes, in accordance with Facebook&apos;s own privacy policy.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We also collect information on whether you responded to a particular advertisement featured on the Website, and which third party advertisements and links you click through the Website through the use of third party tracking pixels, including those from digital sales platform service providers.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Third party technologies like cookies and tracking pixels may also be used to collect personal information, in the course of advertising on or through the Site. We may receive compensation from third party lead aggregators, lead purchasers, and/or advertisers based on leads generated through the Site. Third party publishers may utilize their own cookies and tracking pixels, as noted below.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Apart from use of the above technologies on our Website, we automatically collect information when an individual opens one of our emails, through the use of cookies and tracking pixels. We also automatically collect information on whether the individual clicked on any links within such emails. Third party publishers may also automatically collect information when an individual opens an email promoting the Website or clicks on a link included in such email, through the use of cookies and tracking pixels. To the extent that you click on a third party advertisement, or a particular product or service featured on the Website or in any email communication or newsletter, we and the applicable third party collect information on which link you clicked. We may receive compensation from third party lead aggregators, lead purchasers, and/or advertisers based on clicks, leads, and/or purchases generated through the Website and through any related emails. If you request to unsubscribe from receiving emails, we and our third party publishers may add your email address to our suppression file, to comply with CAN-SPAM.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              In addition to the above, we also may collect information through third party lead aggregators, lead purchasers, and advertisers, concerning whether you acquired information on the featured products and/or services.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>No Information Collected from Children.</strong> We will never knowingly collect any personal information from children under the age of 13. If we obtain actual knowledge that we have collected personal information about a child under the age of 13, that information will be immediately deleted from our database. Because we do not collect such information, we have no such information to use or to disclose to third parties.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">How We Use Information Collected</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Providing the Website, Services and/or Products.</strong> We use the information we gather on our Website to provide you with the services and or products you have requested. We use the information we have collected during your visit to send you an email to complete your registration or provide you with additional offers that may be of interest to you. This may include passing your information on to a third party to provide such services or products. Although our contractual arrangement limits how this party can use your information, we do not control the privacy practices of third parties. If you have any questions or wish to remove your information from the third party databases, you will need to contact that party directly.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Improving Our Website.</strong> We use the information we gather to respond to any inquiries you make, operate and improve the functionality of our Website, and deliver the products and services advertised on our Website. Our services include the display of personalized services or products, content, and advertising, relating to your experience and interests.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Targeted Advertising.</strong> Based on user information, we may customize and target advertising to an individual. In our discretion, we may combine information to target advertising to an individual on the Website, in email, direct mail, and/or through social media. Such advertising may be different to the products or services offered or promoted on our Website.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Commercial Email.</strong> We may use your email address to promote goods and services of third parties that may be of interest to you and these may be different than the products or services offered or promoted on the Website.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Direct Mail.</strong> We may use user information to advertise, directly or indirectly to individuals using postal mail.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>SMS/Text.</strong> To the extent that you have previously opted-in to receive SMS messages/text messages, we may use your telephone number to send you SMS messages/text messages regarding our products and services, even if your telephone number or cell phone number is listed on a state, federal, or corporate &quot;Do Not Call&quot; list and/or Do Not Email registry.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Disclosure of Your Personal Information</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We have disclosed personal information about consumers for a business purpose to third parties within the preceding twelve (12) months as noted here:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans" style={{ minWidth: '650px' }}>
                <thead>
                  <tr>
                    <th className={`${thBase} w-1/4`}>Categories of Personal Information (PI)</th>
                    <th className={`${thBase} w-1/3`}>Categories of Third Parties to Whom Such PI is Disclosed</th>
                    <th className={`${thBase} w-5/12`}>Specific Business or Commercial Purpose for Disclosure</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Identifiers</p>
                      <p className="text-xs">(e.g., a real name, alias, postal address, unique personal identifier, online identifier, Internet Protocol address, email address, account name, social security number, driver&apos;s license number, passport number, or other similar identifiers), or information that identifies, relates to, describes, or is capable of being associated with, a particular individual</p>
                      <Cb checked={false} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={true} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={true} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={true} label="social networks" />
                      <Cb checked={true} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Characteristics of protected classifications</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Commercial information</p>
                      <p className="text-xs">(e.g., records of personal property, products or services purchased, obtained, or considered, or other purchasing or consuming histories or tendencies)</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Biometric information</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Internet or other electronic network activity information</p>
                      <p className="text-xs">(e.g., browsing history, search history, and information regarding a consumer&apos;s interaction with an Internet Web site, application, or advertisement)</p>
                      <Cb checked={false} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={true} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={true} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={true} label="social networks" />
                      <Cb checked={true} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Geolocation data</p>
                      <Cb checked={false} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={true} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={true} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={true} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={true} label="social networks" />
                      <Cb checked={false} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={true} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Audio, electronic, visual, thermal, olfactory, or similar information</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Professional or employment-related information</p>
                      <Cb checked={false} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={true} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={true} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={true} label="social networks" />
                      <Cb checked={true} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Education information</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Inferences drawn from any of the above information to create a profile about a consumer reflecting the consumer&apos;s preferences, characteristics, behavior, etc.</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Sensitive personal information</p>
                      <Cb checked={true} label="not applicable (not disclosed)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>The ways in which we share your personal information with third parties are further described:</p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Product and Service Delivery.</strong> We share your personal information with third parties who help us in the delivery of the products and services you have requested.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Website Functionality and Tracking.</strong> We share your personal information with companies and individuals we employ to perform technical functions on our behalf. Examples include third parties who host our Website, analyze our data, provide marketing assistance, process credit card payments, and provide customer service. In addition, third party service providers are used to record consumer interaction on the Website and entry of information, as well as for advertising purposes.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Third Party Products and Services.</strong> We share your personal information with third parties who will provide you with their opportunities, products, or services. This includes your personal information, and includes your interests and preferences, so they may determine whether you might be interested in their products or services.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Anonymous information.</strong> We share aggregated anonymous information about you, combined with other persons using our Website with third parties, so that they can understand the kinds of visitors that come to our Website, and how those visitors use our Website. This includes demographic information and behavioral information.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Legal Process.</strong> We disclose and share your personal information if legally required to do so, or at our discretion, pursuant to a request from a governmental entity, or if we believe in good faith that such action is necessary to (a) conform to legal requirements or comply with legal process; (b) protect our rights or property, or our affiliated companies; (c) prevent a crime or protect national security; or (d) protect the personal safety of users or the public.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Acquisition or Merger.</strong> We may disclose and transfer your personal information to a third party who acquires any or all of our business, whether such acquisition is by way of merger, consolidation or purchase of all or a substantial portion of our assets. In the event we become the subject of an insolvency proceeding, whether voluntary or involuntary, we or our liquidator, administrator, receiver or administrative receiver may sell, license or otherwise dispose of, such information in a transaction approved by the court.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Third Party Collection and Use of Information</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Third parties collect and use information about you on or through our Website in the following ways:
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Service Providers and Advertisers.</strong> Service Providers of the service or product you have requested, advertising agencies, advertising networks, and other companies who place ads on our Website, may use their own cookies, Web beacons, and other technology, to collect information about you. We do not control the use of such technology and have no responsibility for the use of such technology to gather information about you. Note that service providers may use such personal information to perform a &quot;soft&quot; inquiry of credit, in connection with providing you with the requested service or product.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Hyperlinks.</strong> Our Website and email messages sometimes contain hypertext links to websites owned by third parties. We are not responsible for the privacy practices or the content of such other websites. These links are provided for your convenience and reference only. We do not operate or control any information, software, products or services, available on these third party websites. The inclusion of a link on our website does not imply any endorsement of the services, products or website, or its sponsoring organization.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Analytics.</strong> As described above, we use third parties to monitor, analyze and report on the traffic to, from and within our Website and email messages.
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              <strong>Disclaimer.</strong> We do not control the collection and use of any information collected by third parties. Please review their policies and terms before providing any information.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">With Whom Do We Sell or Share Your Information</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We have sold and shared personal information about consumers for a business purpose to third parties within the preceding twelve (12) months as noted here:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-sans" style={{ minWidth: '650px' }}>
                <thead>
                  <tr>
                    <th className={`${thBase} w-1/4`}>Categories of Personal Information (PI)</th>
                    <th className={`${thBase} w-1/3`}>Categories of Third Parties to Whom Such PI is Sold or Shared</th>
                    <th className={`${thBase} w-5/12`}>Specific Business or Commercial Purpose for Sale or Sharing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Identifiers</p>
                      <p className="text-xs">(e.g., a real name, alias, postal address, unique personal identifier, online identifier, Internet Protocol address, email address, account name, social security number, driver&apos;s license number, passport number, or other similar identifiers), or information that identifies, relates to, describes, or is capable of being associated with, a particular individual</p>
                      <Cb checked={false} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={true} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={false} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={false} label="social networks" />
                      <Cb checked={false} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={true} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Characteristics of protected classifications</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Commercial information</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Biometric information</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Internet or other electronic network activity information</p>
                      <p className="text-xs">(e.g., browsing history, search history, and information regarding a consumer&apos;s interaction with an Internet Web site, application, or advertisement)</p>
                      <Cb checked={false} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={false} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={false} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={false} label="social networks" />
                      <Cb checked={false} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={true} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Geolocation data</p>
                      <Cb checked={false} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={false} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={false} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={false} label="social networks" />
                      <Cb checked={false} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={true} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={false} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Audio, electronic, visual, thermal, olfactory, or similar information</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Professional or employment-related information</p>
                      <Cb checked={false} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={true} label="direct lead buyers" />
                      <Cb checked={false} label="email marketers/email marketing partners" />
                      <Cb checked={false} label="email service providers" />
                      <Cb checked={false} label="offline marketing partners" />
                      <Cb checked={false} label="advertising networks" />
                      <Cb checked={false} label="payment processors" />
                      <Cb checked={false} label="data hygiene companies" />
                      <Cb checked={false} label="ISPs" />
                      <Cb checked={false} label="data analytics providers" />
                      <Cb checked={false} label="gov't entities" />
                      <Cb checked={false} label="operating systems and platforms" />
                      <Cb checked={false} label="social networks" />
                      <Cb checked={false} label="data brokers" />
                      <Cb checked={false} label="acquirer of assets" />
                      <Cb checked={false} label="others" />
                    </td>
                    <td className={tdBase}>
                      <Cb checked={false} label="Auditing related to counting ad impressions to unique visitors, verifying positioning and quality of ad impressions, and auditing compliance with this specification and other standards" />
                      <Cb checked={false} label="Helping to ensure security and integrity" />
                      <Cb checked={false} label="Debugging to identify and repair errors that impair existing intended functionality" />
                      <Cb checked={false} label="Short-term, transient use" />
                      <Cb checked={true} label="Performing services on behalf of the business or service provider, including maintaining or servicing accounts, providing customer service, processing or fulfilling orders and transactions, verifying customer information, processing payments, providing financing, providing advertising or marketing services, providing analytic services, or providing similar services on behalf of the business or service provider" />
                      <Cb checked={false} label="Undertaking internal research for technological development and demonstration" />
                      <Cb checked={false} label="Undertaking activities to verify or maintain the quality or safety of a service or device" />
                    </td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Education information</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Inferences drawn from any of the above information to create a profile about a consumer reflecting the consumer&apos;s preferences, characteristics, behavior, etc.</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>

                  <tr>
                    <td className={tdBase}>
                      <p className="font-semibold mb-1">Sensitive personal information</p>
                      <Cb checked={true} label="not applicable (not sold or shared)" />
                    </td>
                    <td className={tdBase}><NA /></td>
                    <td className={tdBase}><NA /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Information Security</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We use industry standard precautions to safeguard your personal information from loss, theft and misuse including unauthorized access, disclosure, alteration, and destruction. These precautions are technical, physical, and managerial. We have security measures in place to protect against the loss, misuse, and alteration of personal information under our control. The servers in which we store your information are kept in a secure physical environment. The servers have industry standard firewalls. Access to such servers is password protected and access by our employees is limited. Currently, we use Secure Socket Layer software (&quot;SSL&quot;) to protect data and to secure any transactions. SSL encrypts information including credit card number(s), and names and addresses, as they are transmitted over the Internet. Please be advised that, although we take commercially reasonable technological precautions to protect your data, no data transmission over the Internet can be guaranteed to be 100% secure from improper actions of third parties not under our control; therefore, we cannot and do not warrant that your information will be absolutely secure. Any transmission of information through our Website or through email communications is at your own risk.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Changes to Privacy Policy</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We reserve the right to make material changes to the substance of this Privacy Policy. We will post those changes through a prominent notice on the Website, so that you will always know what information we gather, how we might use that information, and to whom we will disclose it.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">GDPR and CASL Compliance</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              Unfortunately, we are not in a position to accept users who are not U.S. Citizens. The CASL and GDPR regulations, in particular, provide certain rights to their citizens which are not the same as the United States. For this reason, we do not accept submissions from any individual outside the United States. Our services are specifically designed for United States citizens. We have expunged all European Union Member and Canadian Citizens data to the extent we have been made aware of the same. If you are a European Union Member, Canadian or resident of any country outside of the United States, please notify us at{' '}
              <a href="mailto:contact@unclesambuyshomes.com" className="text-blue-600 hover:text-blue-800 underline">contact@unclesambuyshomes.com</a>.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Consumer Privacy Requests</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              We believe in the importance of consumer privacy. We do not meet any state privacy thresholds and therefore do not include any state-specific sections in this Privacy Policy. However, residents of any state (including but not limited to California, Colorado, Connecticut, Delaware, Florida, Iowa, Maryland, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Texas, Utah, and Virginia) may submit consumer privacy requests using this link.
            </p>

            <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-[#111827] font-sans mt-4 md:mt-6">Contact Us Concerning Our Privacy Policy</h3>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans" style={{ lineHeight: '1.6' }}>
              If you have any questions regarding this Privacy Policy, please contact:{' '}
              <a href="mailto:contact@unclesambuyshomes.com" className="text-blue-600 hover:text-blue-800 underline">contact@unclesambuyshomes.com</a>
            </p>
            <p className="text-sm lg:text-[0.95rem] xl:text-[1.05rem] text-[#374151] font-sans mt-2" style={{ lineHeight: '1.6' }}>You may write to us at: 1985 Del Amo Blvd #P2150, Torrance, CA, 90501</p>
          </div>
        </div>
      </div>
    </div>
  )
}
