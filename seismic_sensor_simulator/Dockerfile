FROM frolvlad/alpine-python2

# for rpi
#FROM armhf/alpine

#RUN apk add --no-cache python && \
#    python -m ensurepip && \
#    rm -r /usr/lib/python*/ensurepip && \
#    pip install --upgrade pip setuptools && \
#    rm -r /root/.cache

RUN pip install --upgrade pip
RUN pip install ws4py
RUN pip install iofog-container-sdk

COPY index.py /src/
RUN cd /src;

CMD ["python", "/src/index.py", "--log", "DEBUG"]