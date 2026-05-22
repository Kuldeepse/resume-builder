        {/* TAB 4: Interview Prep Panel */}
        {tab === 'prep' && results && (
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <div className="bg-slate-800 p-3 rounded text-white flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-1 font-bold">
                <User className="w-4 h-4 text-indigo-400"/> Recruiter Behavioral & Core Technical Matrix
              </div>
              <button onClick={handleCopyLink} className="bg-white text-slate-800 px-2 py-1 rounded font-bold cursor-pointer text-xxs transition hover:bg-slate-100 shadow-sm border">
                {copied ? "Copied Link Successfully!" : "Copy Generated PDF Link"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-1">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 border-b pb-1 flex items-center gap-1">
                  <User className="w-4 h-4"/> Human Resources Strategy Prep
                </h4>
                {results.hr_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1">
                    <div className="font-bold text-slate-800 flex items-start gap-1">Q: {item.question}</div>
                    <div className="text-slate-600 pl-5">Answer Guide: {item.response}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 border-b pb-1 flex items-center gap-1">
                  <Code className="w-4 h-4"/> Engineering Domain Technical Prep
                </h4>
                {results.technical_interview?.map((item: any, i: number) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border space-y-1">
                    <div className="font-bold text-slate-800 flex items-start gap-1">Q: {item.question}</div>
                    <div className="text-slate-600 pl-5">Technical Strategy: {item.response}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
