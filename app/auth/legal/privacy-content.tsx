export function PrivacyContent() {
  return (
    <div className="legal-content-root">
      <article id="privacy-top" className="privacy-card">
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="legal-updated">Last Updated: Oct 22, 2026</p>
        <div className="legal-toc">
          <div className="legal-toc-title">Contents</div>
          <ol style={{ gridTemplateRows: "repeat(10,auto)" }}>
            <li>
              <a href="#collect">Information We Collect</a>
            </li>
            <li>
              <a href="#use">How We Use Information</a>
            </li>
            <li>
              <a href="#ai-processing">AI Processing</a>
            </li>
            <li>
              <a href="#sharing">How We Share Information</a>
            </li>
            <li>
              <a href="#no-sale">No Sale of Personal Information; No Targeted Advertising</a>
            </li>
            <li>
              <a href="#cookies">Cookies, Analytics, and Similar Technologies</a>
            </li>
            <li>
              <a href="#gpc-dnt">Global Privacy Control and Do Not Track</a>
            </li>
            <li>
              <a href="#retention">Data Retention</a>
            </li>
            <li>
              <a href="#security">Data Security</a>
            </li>
            <li>
              <a href="#breach">Data Breach Notification</a>
            </li>
            <li>
              <a href="#rights">Your Privacy Choices and Rights</a>
            </li>
            <li>
              <a href="#texas">Texas Residents</a>
            </li>
            <li>
              <a href="#california">California Residents</a>
            </li>
            <li>
              <a href="#other-states">Residents of Other U.S. States</a>
            </li>
            <li>
              <a href="#children">Children&apos;s Privacy</a>
            </li>
            <li>
              <a href="#international">U.S. Users; International Access</a>
            </li>
            <li>
              <a href="#third-party">Third-Party Websites and Services</a>
            </li>
            <li>
              <a href="#changes">Changes to This Privacy Policy</a>
            </li>
            <li>
              <a href="#contact">Contact Us</a>
            </li>
          </ol>
        </div>
        <p>This Privacy Policy explains how MarketCatalyst Analytics LLC (&quot;MarketCatalyst,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and shares personal information when you use marketcatalyst.ai, app.marketcatalyst.ai, and related services (the &quot;Service&quot;). It also explains your privacy choices and rights.</p>
        <p>The Service is intended for users in the United States. This Privacy Policy is part of our Terms of Service.</p>
        <h2 id="collect">1. Information We Collect</h2>
        <p>
          <strong>Information you provide to us</strong>
        </p>
        <ul>
          <li>
            <strong>Account information:</strong> your email address and, if you create one, a password. Passwords are handled by our authentication provider (Google Firebase Authentication); we do not see or store your password in readable form.</li>
            <li>
              <strong>Sign-in information from Google:</strong> if you choose &quot;Continue with Google,&quot; Google shares your name, email address, and profile image with us, as permitted by your Google account settings.</li>
              <li>
                <strong>Portfolio and watchlist information:</strong> holdings you add (such as tickers, share quantities, and cost basis), watchlists, alert rules, and similar settings.</li>
                <li>
                  <strong>Images you upload:</strong> for example, screenshots or photos you submit through &quot;Import from photo&quot; so that we can read the holdings shown in them. Please do not upload images that show account numbers or other sensitive information you do not want us to process.</li>
                  <li>
                    <strong>Messages:</strong> your name, email address, company (optional), and message when you use our contact form or email us, along with any support correspondence.</li>
                    <li>
                      <strong>Payment and subscription information:</strong> your plan, billing history, and billing contact details. Payments are processed by our third-party payment processor, Stripe, Inc. (&quot;Stripe&quot;), whose use of your information is governed by its privacy policy at <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">https://stripe.com/privacy</a>. We do not store your full payment card number.</li>
                      <li>
                        <strong>Marketing preferences:</strong> whether you have opted in to or out of marketing emails.</li>
                      </ul>
                      <p>
                        <strong>Information collected automatically</strong>
                      </p>
                      <ul>
                        <li>
                          <strong>Stock search history:</strong> the tickers and terms you search for in the Service.</li>
                          <li>
                            <strong>Usage data:</strong> pages and screens viewed, features used, time spent on the Service, and similar interactions.</li>
                            <li>
                              <strong>Technical data:</strong> IP address, approximate location derived from IP address (such as city or region), browser type, device type, operating system, and device and app identifiers.</li>
                              <li>
                                <strong>Analytics data:</strong> information collected through Google Analytics for Firebase, described in Section 6.</li>
                                <li>
                                  <strong>API usage data:</strong> if your plan includes API access, the requests made with your API key, along with timestamps and volumes.</li>
                                  <li>
                                    <strong>Error and diagnostic data:</strong> stack traces, page context, and device information collected through Sentry when the Service encounters an error.</li>
                                  </ul>
                                  <p>We do not intentionally collect sensitive personal information such as Social Security numbers, brokerage account credentials, precise geolocation, health information, or biometric information. We do not connect to your brokerage accounts.</p>
                                  <h2 id="use">2. How We Use Information</h2>
                                  <p>We use the information we collect to:</p>
                                  <ul>
                                    <li>Provide, operate, and maintain the Service, including your account, portfolio and watchlist tools, alerts, recaps, and API features;</li>
                                    <li>Generate AI summaries and extract holdings from images you upload (see Section 3);</li>
                                    <li>Process payments and manage subscriptions, including renewal, cancellation, and price-change notices;</li>
                                    <li>Send service-related communications, such as confirmations, alerts you set up, security notices, and changes to our terms;</li>
                                    <li>Analyze search patterns and usage to understand how the Service is used and to improve it;</li>
                                    <li>Send marketing communications, which you may opt out of at any time;</li>
                                    <li>Monitor errors, diagnose problems, and keep the Service secure, including detecting fraud, abuse, and violations of our Terms;</li>
                                    <li>Respond to your messages and support requests; and</li>
                                    <li>Comply with our legal obligations and enforce our agreements.</li>
                                  </ul>
                                  <p>We may create de-identified or aggregated information that cannot reasonably be used to identify you, and we may use it for any lawful purpose. We will keep de-identified information in de-identified form and will not try to re-identify it, except as permitted by law.</p>
                                  <h2 id="ai-processing">3. AI Processing</h2>
                                  <p>Some features use third-party AI model providers to generate content. For example:</p>
                                  <ul>
                                    <li>
                                      <strong>Portfolio and watchlist summaries:</strong> your holdings or watchlist tickers may be sent to an AI provider to produce summaries of the day&apos;s drivers, leaders, and laggards.</li>
                                      <li>
                                        <strong>Import from photo:</strong> images you upload are sent to an AI provider to read the holdings shown in them. The image is deleted once the holdings are extracted; only the extracted holdings are retained.</li>
                                      </ul>
                                      <p>We send AI providers only the information needed for the feature, and they process it on our behalf under contracts that restrict how they use it. We do not allow our AI providers to use your personal information to train their models. We do not use AI to make decisions about you that have legal or similarly significant effects.</p>
                                      <h2 id="sharing">4. How We Share Information</h2>
                                      <p>We share personal information only as described below.</p>
                                      <p>
                                        <strong>Service providers.</strong> We share information with vendors that process it on our behalf, under contracts that limit their use of it to providing services to us:</p>
                                        <div className="privacy-table-wrap">
                                          <table className="privacy-table">
                                            <thead>
                                              <tr>
                                                <th>Category</th>
                                                <th>Providers</th>
                                                <th>Purpose</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td>Hosting and cloud infrastructure</td>
                                                <td>Google Cloud / Firebase</td>
                                                <td>Running the Service and storing data</td>
                                              </tr>
                                              <tr>
                                                <td>Authentication</td>
                                                <td>Google (Firebase Authentication, Google Sign-In)</td>
                                                <td>Account sign-in and security</td>
                                              </tr>
                                              <tr>
                                                <td>Analytics</td>
                                                <td>Google (Google Analytics for Firebase)</td>
                                                <td>Understanding how the Service is used</td>
                                              </tr>
                                              <tr>
                                                <td>Error monitoring</td>
                                                <td>Sentry</td>
                                                <td>Detecting and fixing errors</td>
                                              </tr>
                                              <tr>
                                                <td>Payment processing</td>
                                                <td>Stripe, Inc.</td>
                                                <td>Billing and subscriptions</td>
                                              </tr>
                                              <tr>
                                                <td>Email delivery</td>
                                                <td>Twilio SendGrid</td>
                                                <td>Account, alert, and marketing emails</td>
                                              </tr>
                                              <tr>
                                                <td>AI model providers</td>
                                                <td>Third-party AI model providers</td>
                                                <td>AI summaries and image reading (Section 3)</td>
                                              </tr>
                                              <tr>
                                                <td>Market data providers</td>
                                                <td>Our data vendors</td>
                                                <td>Delivering market data; we do not share your personal information with them, except API or subscriber-status information if a provider requires it</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>
                                        <p>
                                          <strong>Other disclosures.</strong> We may also share information:</p>
                                          <ul>
                                            <li>With legal authorities or other parties when required by law, regulation, subpoena, court order, or other valid legal process, or when we believe in good faith that disclosure is necessary to protect the rights, property, or safety of MarketCatalyst, our users, or others;</li>
                                            <li>With a successor entity, or its advisers, in connection with a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of our business or assets; and</li>
                                            <li>With your consent or at your direction.</li>
                                          </ul>
                                          <h2 id="no-sale">5. No Sale of Personal Information; No Targeted Advertising</h2>
                                          <p>We do not sell your personal information, and we have not sold it in the past 12 months. We do not &quot;share&quot; personal information for cross-context behavioral advertising, and we do not process personal information for targeted advertising. We do not show third-party ads on the Service. We have configured Google Analytics without advertising features, including Google Signals and ad-personalization features.</p>
                                          <h2 id="cookies">6. Cookies, Analytics, and Similar Technologies</h2>
                                          <p>We use a small number of cookies and similar technologies (such as browser local storage):</p>
                                          <ul>
                                            <li>
                                              <strong>Essential:</strong> a cookie or similar storage that keeps you signed in and protects the sign-in form. Firebase Authentication also stores sign-in tokens in your browser&apos;s local storage or IndexedDB. The Service cannot function without these.</li>
                                              <li>
                                                <strong>Preferences:</strong> your display and app settings (such as light or dark mode) are stored in your browser&apos;s local storage, not in a cookie.</li>
                                                <li>
                                                  <strong>Analytics:</strong> the MarketCatalyst web app uses Google Analytics for Firebase, a service provided by Google LLC. It uses cookies (such as <code>_ga</code> and <code>_ga_&lt;ID&gt;</code>) and similar identifiers to collect usage data, device and browser information, and approximate location (derived from IP address), so that we can understand how the Service is used. Google processes this data on our behalf. You can learn more at <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">https://policies.google.com/technologies/partner-sites</a> and opt out with the Google Analytics Opt-out Browser Add-on at <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">https://tools.google.com/dlpage/gaoptout</a>.</li>
                                                </ul>
                                                <p>We do not use advertising cookies or cross-site advertising trackers.</p>
                                                <p>
                                                  <strong>Your choices.</strong> You can block or delete cookies in your browser settings. If you block essential cookies or storage, you may not be able to sign in. Blocking analytics cookies will not affect your use of the Service.</p>
                                                  <h2 id="gpc-dnt">7. Global Privacy Control and Do Not Track</h2>
                                                  <ul>
                                                    <li>
                                                      <strong>Global Privacy Control (GPC):</strong> we treat a GPC signal from your browser as a valid request to opt out of the sale or sharing of your personal information and of targeted advertising, for that browser and, if you are signed in, for your account. Because we do not sell or share personal information or engage in targeted advertising, no further change to your experience is required.</li>
                                                      <li>
                                                        <strong>Do Not Track:</strong> some browsers send &quot;Do Not Track&quot; signals. Because there is no common industry standard for these signals, we do not currently respond to them differently, other than as described above for GPC.</li>
                                                      </ul>
                                                      <h2 id="retention">8. Data Retention</h2>
                                                      <p>We keep personal information only as long as reasonably necessary for the purposes described in this Privacy Policy, or as required by law:</p>
                                                      <div className="privacy-table-wrap">
                                                        <table className="privacy-table">
                                                          <thead>
                                                            <tr>
                                                              <th>Information</th>
                                                              <th>Retention period</th>
                                                            </tr>
                                                          </thead>
                                                          <tbody>
                                                            <tr>
                                                              <td>Account information</td>
                                                              <td>For as long as your account is active, then deleted within 30 days after you close your account</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Portfolio holdings, watchlists, and alert rules</td>
                                                              <td>For as long as your account is active, or until you delete them</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Images uploaded through &quot;Import from photo&quot;</td>
                                                              <td>Deleted once the holdings are extracted; only the extracted holdings are retained, as part of your portfolio data</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Stock search history</td>
                                                              <td>1 month, for analytics purposes</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Usage and analytics data</td>
                                                              <td>Up to 2 years, for analytics purposes</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Error and diagnostic data (Sentry)</td>
                                                              <td>Up to 90 days</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Payment and transaction records</td>
                                                              <td>7 years, for tax and regulatory compliance</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Support and contact-form communications</td>
                                                              <td>Up to 3 years</td>
                                                            </tr>
                                                            <tr>
                                                              <td>Marketing preferences and opt-out records</td>
                                                              <td>For as long as needed to honor your choices</td>
                                                            </tr>
                                                          </tbody>
                                                        </table>
                                                      </div>
                                                      <p>Backup copies may persist for up to 90 days after deletion before they are overwritten. We may keep information longer if needed to comply with law, resolve disputes, prevent fraud or abuse, or enforce our agreements.</p>
                                                      <h2 id="security">9. Data Security</h2>
                                                      <ul>
                                                        <li>We use industry-standard encryption (TLS/SSL) to protect data in transit, and our cloud providers encrypt data at rest.</li>
                                                        <li>Payment data is handled by PCI-compliant payment processors.</li>
                                                        <li>We limit access to personal information to people who need it to operate the Service, and we maintain access controls and monitoring around our infrastructure.</li>
                                                        <li>We periodically review our security practices and apply security updates.</li>
                                                      </ul>
                                                      <p>No method of transmission or storage is 100% secure, and we cannot guarantee absolute security. You are responsible for keeping your account credentials and API keys confidential.</p>
                                                      <h2 id="breach">10. Data Breach Notification</h2>
                                                      <p>If we learn of a security breach that affects your personal information, we will notify you, and any regulators as required, in accordance with applicable law, including the Texas Identity Theft Enforcement and Protection Act and other state breach-notification laws. We will usually notify you by email to the address on your account.</p>
                                                      <h2 id="rights">11. Your Privacy Choices and Rights</h2>
                                                      <p>
                                                        <strong>Choices available to all users</strong>
                                                      </p>
                                                      <ul>
                                                        <li>
                                                          <strong>Access and export:</strong> request a copy of the personal information we hold about you, in a portable format where applicable.</li>
                                                          <li>
                                                            <strong>Correction:</strong> update your account information in your account settings, or ask us to correct inaccurate information.</li>
                                                            <li>
                                                              <strong>Deletion:</strong> delete your account or personal information. You can delete holdings and watchlists in the app at any time.</li>
                                                              <li>
                                                                <strong>Marketing:</strong> unsubscribe from marketing emails at any time using the link in any marketing email or by contacting us. We will still send service-related messages.</li>
                                                                <li>
                                                                  <strong>Analytics:</strong> opt out of Google Analytics as described in Section 6.</li>
                                                                </ul>
                                                                <p>
                                                                  <strong>How to submit a request.</strong> Email <a href="mailto:contact@marketcatalyst.ai">contact@marketcatalyst.ai</a> with the subject line &quot;Privacy Request.&quot; Tell us which right you want to use and which email address is associated with your account.</p>
                                                                  <p>
                                                                    <strong>Verification.</strong> To protect your information, we will verify your identity before acting on a request, usually by confirming control of the email address associated with your account. We may ask for more information if needed. We will use that information only for verification.</p>
                                                                    <p>
                                                                      <strong>Authorized agents.</strong> Where permitted by law, you may use an authorized agent to submit a request. We may require written proof of the agent&apos;s authority and may ask you to verify your identity directly.</p>
                                                                      <p>
                                                                        <strong>Response timing.</strong> We will respond within 45 days of receiving your request. If reasonably necessary, we may extend this by another 45 days, and we will tell you if we do.</p>
                                                                        <p>
                                                                          <strong>Appeals.</strong> If we decline your request, you may appeal by emailing <a href="mailto:contact@marketcatalyst.ai">contact@marketcatalyst.ai</a> with the subject line &quot;Privacy Appeal&quot; within a reasonable time after our decision. We will respond to your appeal within 60 days (or 45 days where required by law) and explain the reasons for our decision.</p>
                                                                          <p>
                                                                            <strong>No discrimination.</strong> We will not discriminate against you for exercising your privacy rights. For example, we will not deny you service or charge you a different price.</p>
                                                                            <h2 id="texas">12. Texas Residents</h2>
                                                                            <p>If you are a Texas resident, the Texas Data Privacy and Security Act (&quot;TDPSA&quot;) may give you the right to:</p>
                                                                            <ul>
                                                                              <li>Confirm whether we are processing your personal data and access it;</li>
                                                                              <li>Correct inaccuracies in your personal data;</li>
                                                                              <li>Delete personal data you provided or that we obtained about you;</li>
                                                                              <li>Obtain a copy of your personal data in a portable and, where technically feasible, readily usable format; and</li>
                                                                              <li>Opt out of the processing of your personal data for targeted advertising, the sale of personal data, or profiling that produces legal or similarly significant effects.</li>
                                                                            </ul>
                                                                            <p>
                                                                              <strong>Our practices:</strong> we do not sell personal data, do not process personal data for targeted advertising, and do not engage in profiling that produces legal or similarly significant effects. We do not process sensitive data, as defined by the TDPSA, and we do not sell sensitive data.</p>
                                                                              <p>To use your rights, follow the process in Section 11. You may exercise these rights at no cost up to twice per year. If we deny your request, you may appeal as described in Section 11. If your appeal is denied, you may contact the Texas Attorney General at <a href="https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint" target="_blank" rel="noopener noreferrer">https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint</a>.</p>
                                                                              <h2 id="california">13. California Residents</h2>
                                                                              <p>If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act (&quot;CCPA&quot;), may give you the rights described in this section.</p>
                                                                              <p>
                                                                                <strong>Categories of personal information we collect (in the past 12 months):</strong>
                                                                              </p>
                                                                              <div className="privacy-table-wrap">
                                                                                <table className="privacy-table">
                                                                                  <thead>
                                                                                    <tr>
                                                                                      <th>CCPA category</th>
                                                                                      <th>Examples</th>
                                                                                      <th>Disclosed for a business purpose to</th>
                                                                                    </tr>
                                                                                  </thead>
                                                                                  <tbody>
                                                                                    <tr>
                                                                                      <td>Identifiers</td>
                                                                                      <td>Name, email address, IP address, device and account identifiers</td>
                                                                                      <td>Hosting, authentication, analytics, error-monitoring, email, and payment providers</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Customer records (Cal. Civ. Code § 1798.80(e))</td>
                                                                                      <td>Name, billing contact details, limited payment information</td>
                                                                                      <td>Payment processor, hosting</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Commercial information</td>
                                                                                      <td>Subscription plan, purchase history</td>
                                                                                      <td>Payment processor, hosting</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Internet or network activity</td>
                                                                                      <td>Usage data, search history, API usage, diagnostic data</td>
                                                                                      <td>Hosting, analytics, error monitoring</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Approximate geolocation</td>
                                                                                      <td>City or region derived from IP address</td>
                                                                                      <td>Analytics</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Audio, electronic, or visual information</td>
                                                                                      <td>Images you upload through &quot;Import from photo&quot;</td>
                                                                                      <td>Hosting, AI model providers</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Financial information you choose to enter</td>
                                                                                      <td>Portfolio holdings and cost basis (not bank or brokerage account numbers)</td>
                                                                                      <td>Hosting, AI model providers</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Inferences</td>
                                                                                      <td>Feature preferences inferred from usage</td>
                                                                                      <td>Analytics</td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                      <td>Sensitive personal information</td>
                                                                                      <td>Account login credentials (email and password)</td>
                                                                                      <td>Authentication provider</td>
                                                                                    </tr>
                                                                                  </tbody>
                                                                                </table>
                                                                              </div>
                                                                              <p>
                                                                                <strong>Sources:</strong> you; your browser or device; Google, if you sign in with Google; and our service providers.</p>
                                                                                <p>
                                                                                  <strong>Purposes:</strong> the business and commercial purposes described in Sections 2 and 3.</p>
                                                                                  <p>
                                                                                    <strong>Retention:</strong> see Section 8.</p>
                                                                                    <p>
                                                                                      <strong>Sale and sharing:</strong> we do not sell personal information or share it for cross-context behavioral advertising, and we have no actual knowledge of selling or sharing the personal information of consumers under 16.</p>
                                                                                      <p>
                                                                                        <strong>Sensitive personal information:</strong> we use sensitive personal information only to provide the Service and for other purposes permitted by the CCPA, and not to infer characteristics about you. As a result, we do not offer a right to limit its use.</p>
                                                                                        <p>
                                                                                          <strong>Your rights:</strong> you may have the right to know what personal information we collect, use, and disclose; to access it; to delete it; to correct it; and to opt out of its sale or sharing (which we do not do). You also have the right not to be discriminated against for exercising these rights. To use your rights, follow the process in Section 11. An authorized agent may submit a request on your behalf as described there.</p>
                                                                                          <p>
                                                                                            <strong>Shine the Light:</strong> we do not disclose personal information to third parties for their own direct marketing purposes.</p>
                                                                                            <h2 id="other-states">14. Residents of Other U.S. States</h2>
                                                                                            <p>Residents of Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Utah, Virginia, and other states with comprehensive privacy laws may have rights similar to those described in Sections 12 and 13. These may include the rights to confirm, access, correct, delete, and obtain a portable copy of personal data, and to opt out of targeted advertising, sale, and certain profiling. To use these rights, follow the process in Section 11. If we deny your request, you may appeal as described there, and you may contact your state Attorney General if you are not satisfied with the outcome of your appeal.</p>
                                                                                            <p>Nevada residents: we do not sell covered information as defined by Nevada law.</p>
                                                                                            <h2 id="children">15. Children&apos;s Privacy</h2>
                                                                                            <p>The Service is not intended for, or directed at, individuals under the age of 18. We do not knowingly collect personal information from children. If we learn that we have collected personal information from a child under 18, we will take steps to delete it. If you believe a child has provided us with personal information, please contact us at <a href="mailto:contact@marketcatalyst.ai">contact@marketcatalyst.ai</a>.</p>
                                                                                            <h2 id="international">16. U.S. Users; International Access</h2>
                                                                                            <p>The Service is intended for users in the United States and is not directed to residents of the European Economic Area, the United Kingdom, or Switzerland. If you access the Service from outside the United States, your information will be transferred to, stored, and processed in the United States, where our servers and service providers are located, and where data protection laws may differ from those in your country.</p>
                                                                                            <h2 id="third-party">17. Third-Party Websites and Services</h2>
                                                                                            <p>The Service may contain links to, or integrations with, third-party websites and services, such as Google sign-in, our payment processor, and brokers or news sources. This Privacy Policy does not apply to, and we are not responsible for, the privacy practices of those third parties. We encourage you to review the privacy policy of any third-party site or service you use.</p>
                                                                                            <h2 id="changes">18. Changes to This Privacy Policy</h2>
                                                                                            <p>We may update this Privacy Policy from time to time. We will post the updated version on the Service and change the &quot;Last Updated&quot; date above. If we make material changes, such as using personal information in a materially different way, we will notify you by email or by a prominent notice on the Service before the changes take effect, and we will get your consent where required by law.</p>
                                                                                            <h2 id="contact">19. Contact Us</h2>
                                                                                            <p>For questions about this Privacy Policy or your personal information, or to submit a privacy request:</p>
                                                                                            <p>MarketCatalyst Analytics LLC<br/>Email: <a href="mailto:contact@marketcatalyst.ai">contact@marketcatalyst.ai</a>
                                                                                            </p>
                                                                                            <a className="privacy-back-top" href="#privacy-top">↑ Back to top</a>
                                                                                          </article>
    </div>
  );
}
