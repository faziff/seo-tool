            {currentTab === 'seo-analysis' && (
              report ? (
                <SEOAnalysisPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No SEO Analysis Available',
                  'Scan a website to audit title tags, meta descriptions, H1 headings, content length, and OpenGraph tags.'
                )
              )
            )}

            {currentTab === 'keyword-research' && <KeywordResearchPage />}

            {currentTab === 'market-research' && <MarketResearchPage />}

            {currentTab === 'fix-center' && (
              <FixCenterPage report={report} onFocusScanner={focusScannerInput} />
            )}

            {currentTab === 'performance' && (
              report ? (
                <PerformancePage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Performance Metrics Available',
                  'Analyze page TTFB (Time to First Byte) and Google Core Web Vitals by entering a website URL.'
                )
              )
            )}

            {currentTab === 'accessibility' && (
              report ? (
                <AccessibilityPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Accessibility Findings Available',
                  'Check missing image alt texts, viewport configuration, and document language declaration across your site.'
                )
              )
            )}

            {currentTab === 'technical' && (
              report ? (
                <TechnicalIssuesPage
                  report={report}
                  onSelectIssue={(iss) => setSelectedIssue(iss)}
                  onQuickResolve={handleIssueStatusChanged}
                />
              ) : (
                renderEmptySubpage(
                  'No Technical Issues Logged',
                  'Audit your site to detect broken links, redirect chains, structured data problems, and mixed content.'
                )
              )
            )}

            {currentTab === 'content' && (
              report ? (
                <SEOAnalysisPage report={report} />
              ) : (
                renderEmptySubpage(
                  'No Content Opportunities Identified',
                  'Perform a website crawl to detect thin content pages, missing descriptions, and heading hierarchy issues.'
                )
              )
            )}

            {currentTab === 'ai-assistant' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-4 max-w-xl mx-auto my-8">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <NovaOrb size={35} />
                </div>
                <h2 className="text-lg font-bold text-slate-900">NOVA AI Assistant</h2>
                <p className="text-xs text-slate-600">
                  {report
                    ? `Open the interactive copilot drawer to analyze findings for ${report.domain}, generate custom metadata, and get step-by-step remediation advice.`
                    : 'NOVA analyzes your audit context and helps generate code fixes, metadata, content briefs, and step-by-step SEO recommendations.'}
                </p>
                <button
                  onClick={() => setIsAIOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors"
                >
                  Open NOVA Copilot
                </button>
              </div>
            )}

            {currentTab === 'reports' && (
              <ReportsPage
                currentReport={report}
                recentScans={recentScans}
                onSelectScan={handleSelectScan}
                onOpenCompare={() => setIsCompareOpen(true)}
                onFocusScanner={focusScannerInput}
              />
            )}

            {currentTab === 'settings' && <SettingsPage />}

            {['ai-visibility', 'local-seo', 'advertising', 'ai-pr', 'social', 'position-tracking', 'keyword-gap', 'backlinks'].includes(currentTab) && (
              <ModulePreviewPage moduleId={currentTab} onOpenTab={setCurrentTab} />
            )}
          </main>
        </div>
      </div>

      {/* Slide-out / Modal Dialogs */}
      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onStatusChanged={handleIssueStatusChanged}
      />

      <AIAssistantDrawer
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        report={report}
      />

      <CompareScansModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        recentScans={recentScans}
        currentReport={report}
      />

    </div>
  );
