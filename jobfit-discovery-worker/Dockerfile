FROM unclecode/crawl4ai:0.9.3

USER root
WORKDIR /opt/cognitwist-worker

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser app.py ./app.py
RUN chown -R appuser:appuser /opt/cognitwist-worker

USER appuser
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
